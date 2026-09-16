import re
from datetime import UTC, datetime
from enum import StrEnum
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class EvidenceStatus(StrEnum):
    REPORTED = "REPORTED"
    IN_VERIFICATION = "IN_VERIFICATION"
    CONFIRMED_REGIONAL_RESTRICTION = "CONFIRMED_REGIONAL_RESTRICTION"
    GLOBAL_OUTAGE = "GLOBAL_OUTAGE"
    ANOMALY_INCONCLUSIVE = "ANOMALY_INCONCLUSIVE"
    UNRESTRICTED = "UNRESTRICTED"


class Platform(StrEnum):
    Instagram = "Instagram"
    X = "X"
    YouTube = "YouTube"
    WebDomain = "WebDomain"
    Other = "Other"


class ReportedIssue(StrEnum):
    GeoBlockedNotice = "GeoBlockedNotice"
    HTTP451 = "HTTP451"
    DNSResolutionFailure = "DNSResolutionFailure"
    DelistedSearch = "DelistedSearch"
    AccountSuspended = "AccountSuspended"


class EgressType(StrEnum):
    ResidentialProxy = "ResidentialProxy"
    DatacenterProxy = "DatacenterProxy"
    LocalInterface = "LocalInterface"
    MockFixture = "MockFixture"


DISCLAIMER = "Automated research analysis; not a judicial determination or legal advice."


class Base(DeclarativeBase):
    pass


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    target_url: Mapped[str] = mapped_column(String(2048))
    platform: Mapped[Platform] = mapped_column(Enum(Platform), index=True)
    reported_issue: Mapped[ReportedIssue] = mapped_column(Enum(ReportedIssue))
    reported_region: Mapped[str] = mapped_column(String(200), index=True)
    reported_isp: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[EvidenceStatus] = mapped_column(
        Enum(EvidenceStatus), default=EvidenceStatus.REPORTED, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_simulation: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_error: Mapped[str | None] = mapped_column(String(500))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    telemetry: Mapped[list["ProbeTelemetry"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    legal_audit: Mapped["LegalAudit | None"] = relationship(cascade="all, delete-orphan", lazy="selectin")


class ProbeTelemetry(Base):
    __tablename__ = "probe_telemetry"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(ForeignKey("reports.id"), index=True)
    vantage_point: Mapped[str] = mapped_column(String(100))
    country_code: Mapped[str] = mapped_column(String(2))
    is_domestic: Mapped[bool] = mapped_column(Boolean)
    egress_type: Mapped[EgressType] = mapped_column(Enum(EgressType))
    # A timeout is not HTTP 0 and a proxy failure is not proven DNS refusal.
    http_status: Mapped[int | None] = mapped_column(Integer)
    dns_resolved: Mapped[bool | None] = mapped_column(Boolean)
    dom_signature_matched: Mapped[str | None] = mapped_column(String(500))
    response_time_ms: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_simulation: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(String(200))
    attempt: Mapped[int] = mapped_column(Integer, default=1)


class LegalAudit(Base):
    __tablename__ = "legal_audits"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(ForeignKey("reports.id"), unique=True)
    primary_jurisdiction: Mapped[str] = mapped_column(String(200))
    applicable_frameworks: Mapped[list[str]] = mapped_column(JSON)
    procedural_indicators: Mapped[dict[str, Any]] = mapped_column(JSON)
    potential_concerns: Mapped[list[str]] = mapped_column(JSON)
    confidence_score: Mapped[float] = mapped_column(Float)
    confidence_basis: Mapped[str] = mapped_column(String(500))
    citations: Mapped[list[dict]] = mapped_column(JSON)
    disclaimer: Mapped[str] = mapped_column(String(500), default=DISCLAIMER)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    generation_mode: Mapped[str] = mapped_column(String(80), default="deterministic_retrieval")


def validate_target(value: str) -> str:
    value = value.strip()
    try:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            raise ValueError("Use a full http or https resource URL.")
        if parts.username or parts.password or parts.port not in {None, 80, 443}:
            raise ValueError("Credentials and nonstandard ports are not accepted.")
        host = parts.hostname.lower().rstrip(".")
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")) or "." not in host:
            raise ValueError("A public internet hostname is required.")
        try:
            address = ip_address(host)
        except ValueError:
            address = None
        if address is None and re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*", host):
            raise ValueError("Use a canonical public IP address or a public hostname.")
        if address and not address.is_global:
            raise ValueError("Private and reserved addresses cannot be probed.")
        if any(ord(c) < 32 or c.isspace() for c in value) or "\\" in value:
            raise ValueError("The URL contains invalid characters.")
    except (ValueError, TypeError) as exc:
        raise ValueError(str(exc)) from exc
    return parts._replace(fragment="").geturl()


class ReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    target_url: str = Field(min_length=8, max_length=2048)
    platform: Platform
    reported_issue: ReportedIssue
    reported_region: str = Field(min_length=2, max_length=200)
    reported_isp: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    _url = field_validator("target_url")(validate_target)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", "timestamp", "generated_at", check_fields=False)
    @classmethod
    def utc_dates(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class TelemetryRead(ORMModel):
    id: UUID
    vantage_point: str
    country_code: str
    is_domestic: bool
    egress_type: EgressType
    http_status: int | None
    dns_resolved: bool | None
    dom_signature_matched: str | None
    response_time_ms: float
    timestamp: datetime
    is_simulation: bool
    error: str | None
    attempt: int


class AuditPayload(BaseModel):
    primary_jurisdiction: str
    applicable_frameworks: list[str]
    procedural_indicators: dict[str, bool | None]
    potential_concerns: list[str]
    confidence_score: float = Field(ge=0, le=1)
    confidence_basis: str
    citations: list[dict[str, Any]]
    disclaimer: str = DISCLAIMER
    generation_mode: str = "deterministic_retrieval"


class AuditRead(AuditPayload, ORMModel):
    id: UUID
    generated_at: datetime


class ReportRead(ORMModel):
    id: UUID
    target_url: str
    platform: Platform
    reported_issue: ReportedIssue
    reported_region: str
    reported_isp: str | None
    notes: str | None
    status: EvidenceStatus
    created_at: datetime
    is_simulation: bool
    verification_error: str | None
    telemetry: list[TelemetryRead]


class DossierRead(ReportRead):
    legal_audit: AuditRead | None
    disclaimer: str = DISCLAIMER
