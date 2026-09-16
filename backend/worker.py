"""Durable DB queue with atomic claims and expiring leases; python -m backend.worker."""

import asyncio
import logging
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import and_, or_, select, update

from .config import get_settings
from .database import SessionLocal, init_db
from .legal_rag import generate_legal_audit
from .models import EvidenceStatus, Report, utcnow
from .probes import configured_vantages, run_multi_vantage_check

log = logging.getLogger(__name__)


def claim_next():
    now = utcnow()
    eligible = or_(
        Report.status == EvidenceStatus.REPORTED,
        and_(Report.status == EvidenceStatus.IN_VERIFICATION, Report.lease_expires_at < now),
    )
    with SessionLocal() as db:
        report_id = db.scalar(select(Report.id).where(eligible).order_by(Report.created_at).limit(1))
        if report_id is None:
            return None
        token = str(uuid4())
        changed = db.execute(
            update(Report)
            .where(Report.id == report_id, eligible)
            .values(
                status=EvidenceStatus.IN_VERIFICATION,
                lease_token=token,
                lease_expires_at=now + timedelta(seconds=get_settings().worker_lease_seconds),
            )
        )
        db.commit()
        return (report_id, token) if changed.rowcount else None


async def process_claim(report_id, token):
    with SessionLocal() as db:
        report = db.get(Report, report_id)
        target_url = report.target_url
    try:
        result = await run_multi_vantage_check(target_url)
        with SessionLocal() as db:
            # Conditional write locks ownership through the telemetry/audit commit.
            owned = db.execute(
                update(Report)
                .where(Report.id == report_id, Report.lease_token == token)
                .values(
                    status=result.status,
                    is_simulation=result.is_simulation,
                    lease_token=None,
                    lease_expires_at=None,
                    verification_error=None,
                )
            )
            if not owned.rowcount:
                db.rollback()
                return
            report = db.get(Report, report_id)
            report.telemetry = result.telemetry
            report.legal_audit = generate_legal_audit(report, result.telemetry)
            db.commit()
    except asyncio.CancelledError:
        # Lease expiry allows another process to recover interrupted jobs.
        raise
    except Exception as exc:  # noqa: BLE001 -- isolate a failed queue job; do not leak exception secrets
        log.error("Verification failed for %s (%s)", report_id, type(exc).__name__)
        with SessionLocal() as db:
            db.execute(
                update(Report)
                .where(Report.id == report_id, Report.lease_token == token)
                .values(
                    status=EvidenceStatus.ANOMALY_INCONCLUSIVE,
                    lease_token=None,
                    lease_expires_at=None,
                    verification_error=f"Verification could not complete ({type(exc).__name__}). Check worker configuration.",
                )
            )
            db.commit()


async def worker_loop():
    while True:
        try:
            claim = claim_next()
            if claim:
                await process_claim(*claim)
            else:
                await asyncio.sleep(get_settings().worker_poll_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Queue polling failed; retrying")
            await asyncio.sleep(get_settings().worker_poll_seconds)


def main():
    logging.basicConfig(level=logging.INFO)
    configured_vantages(get_settings())
    init_db()
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
