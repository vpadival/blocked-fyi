import asyncio
from collections import Counter
from contextlib import asynccontextmanager, suppress
from typing import Annotated
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db, init_db
from .models import DossierRead, EvidenceStatus, Platform, Report, ReportCreate, ReportRead
from .probes import configured_vantages
from .worker import worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    configured_vantages(get_settings())  # Partial live configuration fails closed.
    init_db()
    task = asyncio.create_task(worker_loop()) if get_settings().embedded_worker else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Blocked.fyi", version="0.1.0", lifespan=lifespan)
Database = Annotated[Session, Depends(get_db)]
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins.split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/v1/health")
def health():
    nodes = configured_vantages(get_settings())
    return {
        "status": "ok",
        "probe_mode": "live" if nodes else "mock",
        "vantage_count": len(nodes) if nodes else 4,
        "embedded_worker": get_settings().embedded_worker,
    }


@app.post("/api/v1/reports", response_model=ReportRead, status_code=201)
def create_report(payload: ReportCreate, db: Database):
    report = Report(
        **payload.model_dump(),
        status=EvidenceStatus.REPORTED,
        is_simulation=not bool(configured_vantages(get_settings())),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    # The committed REPORTED row is the durable job; no fire-and-forget task can lose it.
    return report


@app.get("/api/v1/reports")
def list_reports(
    db: Database,
    status: EvidenceStatus | None = None,
    platform: Platform | None = None,
    region: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    filters = []
    if status:
        filters.append(Report.status == status)
    if platform:
        filters.append(Report.platform == platform)
    if region:
        filters.append(Report.reported_region.icontains(region, autoescape=True))
    total = db.scalar(select(func.count()).select_from(Report).where(*filters))
    rows = db.scalars(
        select(Report)
        .where(*filters)
        .order_by(Report.created_at.desc(), Report.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [ReportRead.model_validate(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/v1/reports/{report_id}", response_model=DossierRead)
def dossier(report_id: UUID, db: Database):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@app.get("/api/v1/stats")
def stats(db: Database):
    count = lambda *conditions: db.scalar(select(func.count()).select_from(Report).where(*conditions)) or 0
    verified = (
        Report.status == EvidenceStatus.CONFIRMED_REGIONAL_RESTRICTION,
        Report.is_simulation.is_(False),
    )
    domains = Counter(
        urlsplit(url).hostname for url in db.scalars(select(Report.target_url).where(*verified))
    )
    return {
        "total_leads": count(),
        "confirmed_blocks": count(*verified),
        "active_probes": count(Report.status == EvidenceStatus.IN_VERIFICATION),
        "queued_leads": count(Report.status == EvidenceStatus.REPORTED),
        "simulated_leads": count(Report.is_simulation.is_(True)),
        "top_flagged_domains": [{"domain": domain, "count": n} for domain, n in domains.most_common(5)],
    }
