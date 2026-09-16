"""Optional synthetic demo records on reserved example domains."""

from datetime import timedelta

from sqlalchemy import select

from .database import SessionLocal, init_db
from .legal_rag import generate_legal_audit
from .models import Platform, Report, ReportedIssue, utcnow
from .probes import classify, mock_rows


def main():
    init_db()
    entries = [
        ("news.example.com", "Bengaluru", "regional", Platform.WebDomain),
        ("video.example.org", "Mumbai", "unrestricted", Platform.YouTube),
        ("social.example.com", "Delhi", "inconclusive", Platform.X),
        ("archive.example.org", "Chennai", "outage", Platform.WebDomain),
        ("photos.example.com", "Hyderabad", "regional", Platform.Instagram),
        ("journal.example.net", "Kolkata", "unrestricted", Platform.WebDomain),
        ("community.example.org", "Pune", "inconclusive", Platform.Other),
        ("media.example.net", "Kochi", "regional", Platform.WebDomain),
        ("radio.example.com", "Jaipur", "outage", Platform.WebDomain),
    ]
    with SessionLocal() as db:
        added = 0
        for i, (domain, region, scenario, platform) in enumerate(entries):
            url = f"https://{domain}/demo-resource"
            if db.scalar(select(Report.id).where(Report.target_url == url)):
                continue
            rows = mock_rows(scenario)
            report = Report(
                target_url=url,
                platform=platform,
                reported_issue=ReportedIssue.GeoBlockedNotice,
                reported_region=f"India / {region}",
                reported_isp=f"ISP-{'A' if i % 2 else 'B'} (fixture)",
                status=classify(rows),
                is_simulation=True,
                created_at=utcnow() - timedelta(minutes=i * 37),
                notes="Synthetic example for the demo. No resource was contacted.",
                telemetry=rows,
            )
            db.add(report)
            db.flush()
            report.legal_audit = generate_legal_audit(report, rows)
            added += 1
        db.commit()
    print(f"Added {added} labeled demo fixtures. No real probes executed.")


if __name__ == "__main__":
    main()
