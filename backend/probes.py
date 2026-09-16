"""Independent egress probes. Fixtures never make network requests."""

import asyncio
import json
import logging
import os
import socket
from dataclasses import dataclass
from ipaddress import ip_address
from time import perf_counter
from urllib.parse import urlsplit

import httpx
from dotenv import dotenv_values
from pydantic import BaseModel, Field, model_validator

from .config import ROOT, Settings, get_settings
from .models import EgressType, EvidenceStatus, ProbeTelemetry, utcnow, validate_target

log = logging.getLogger(__name__)
BLOCK_TOKENS = (
    "this content is restricted in your region under legal demand",
    "unavailable for legal reasons",
    "blocked as per the directions",
    "withheld in your country in response to a legal demand",
)


class Vantage(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    domestic: bool = False
    egress_type: EgressType = EgressType.DatacenterProxy
    http_proxy_env: str
    https_proxy_env: str
    public_only_egress: bool = False

    @model_validator(mode="after")
    def real_egress(self):
        if self.egress_type not in {EgressType.ResidentialProxy, EgressType.DatacenterProxy}:
            raise ValueError("Live vantages must use independent proxies.")
        if not self.public_only_egress:
            raise ValueError("Live proxies must enforce public-address-only egress ACLs.")
        return self


@dataclass
class ProbeResult:
    status: EvidenceStatus
    telemetry: list[ProbeTelemetry]
    is_simulation: bool


def proxy_value(name: str) -> str:
    return os.environ.get(name, dotenv_values(ROOT / "backend" / ".env").get(name) or "")


def configured_vantages(settings: Settings) -> list[Vantage]:
    if settings.probe_mode not in {"auto", "mock", "live"}:
        raise ValueError("PROBE_MODE must be auto, mock, or live.")
    if settings.probe_mode == "mock":
        return []
    if not settings.vantage_config:
        if settings.probe_mode == "live":
            raise ValueError("Live mode requires VANTAGE_CONFIG.")
        return []
    nodes = [Vantage.model_validate(item) for item in json.loads(settings.vantage_config)]
    if not 3 <= len(nodes) <= 8 or len({n.name for n in nodes}) != len(nodes):
        raise ValueError("Configure three to eight uniquely named vantages.")
    domestic = [n for n in nodes if n.domestic]
    controls = [n for n in nodes if not n.domestic]
    if not domestic or len({n.country_code for n in domestic}) != 1:
        raise ValueError("Choose exactly one domestic country under test.")
    if len({n.country_code for n in controls}) < 2 or any(
        n.country_code == domestic[0].country_code for n in controls
    ):
        raise ValueError("Two distinct international control countries are required.")
    for scheme in ("http", "https"):
        endpoints = [proxy_value(getattr(n, f"{scheme}_proxy_env")) for n in nodes]
        if not all(endpoints) or len(set(endpoints)) != len(nodes):
            raise ValueError("Each vantage needs a distinct configured proxy for each URL scheme.")
        if any(urlsplit(p).scheme not in {"http", "https"} or not urlsplit(p).hostname for p in endpoints):
            raise ValueError("Proxy endpoints must be valid HTTP(S) URLs.")
    return nodes


def classify(rows: list[ProbeTelemetry]) -> EvidenceStatus:
    domestic = [r for r in rows if r.is_domestic]
    controls = [r for r in rows if not r.is_domestic]
    if not domestic or len({r.country_code for r in controls}) < 2:
        return EvidenceStatus.ANOMALY_INCONCLUSIVE
    if len({r.is_simulation for r in rows}) != 1 or any(r.error for r in rows):
        return EvidenceStatus.ANOMALY_INCONCLUSIVE
    accessible = lambda r: r.http_status == 200 and not r.dom_signature_matched
    blocked = lambda r: r.http_status == 451 or bool(r.dom_signature_matched)
    if all(blocked(r) for r in domestic) and all(accessible(r) for r in controls):
        return EvidenceStatus.CONFIRMED_REGIONAL_RESTRICTION
    if all(r.http_status in {404, 500} and not r.dom_signature_matched for r in rows):
        return EvidenceStatus.GLOBAL_OUTAGE
    if all(accessible(r) for r in rows):
        return EvidenceStatus.UNRESTRICTED
    return EvidenceStatus.ANOMALY_INCONCLUSIVE


async def ensure_public_destination(target_url: str):
    """Preflight only; proxy-side ACLs also prevent remote DNS rebinding."""
    host = urlsplit(target_url).hostname
    records = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    if not records or any(not ip_address(item[4][0]).is_global for item in records):
        raise ValueError("Target must resolve exclusively to public internet addresses.")


async def probe_once(target_url: str, node: Vantage, settings: Settings, attempt: int) -> ProbeTelemetry:
    started = perf_counter()
    row = ProbeTelemetry(
        vantage_point=node.name,
        country_code=node.country_code,
        is_domestic=node.domestic,
        egress_type=node.egress_type,
        http_status=None,
        dns_resolved=None,
        dom_signature_matched=None,
        response_time_ms=0,
        timestamp=utcnow(),
        is_simulation=False,
        error=None,
        attempt=attempt,
    )
    scheme = urlsplit(target_url).scheme
    proxy = proxy_value(getattr(node, f"{scheme}_proxy_env"))
    try:
        # Overall deadline also limits slow streams; redirects are recorded, never followed.
        async with asyncio.timeout(settings.probe_timeout_seconds):
            async with httpx.AsyncClient(
                proxy=proxy, trust_env=False, follow_redirects=False, timeout=settings.probe_timeout_seconds
            ) as client:
                async with client.stream(
                    "GET", target_url, headers={"User-Agent": "Blocked.fyi/0.1 research-probe"}
                ) as response:
                    row.http_status = response.status_code
                    body = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        body.extend(chunk[: max(0, 131072 - len(body))])
                        if len(body) >= 131072:
                            break
                    content = body.decode("utf-8", errors="replace").lower()
                    row.dom_signature_matched = next(
                        (token for token in BLOCK_TOKENS if token in content), None
                    )
                    # HTTP proxies do not expose authoritative target DNS results.
    except (httpx.HTTPError, TimeoutError) as exc:
        row.error = type(exc).__name__  # Never persist proxy credentials from exception strings.
    row.response_time_ms = round((perf_counter() - started) * 1000, 2)
    return row


def mock_rows(scenario: str) -> list[ProbeTelemetry]:
    if scenario not in {"regional", "outage", "unrestricted", "inconclusive"}:
        raise ValueError("Unknown MOCK_SCENARIO.")
    rows = []
    for attempt in (1, 2):
        for i, (name, country, domestic) in enumerate(
            [
                ("Fixture-IN-ISP-A", "IN", True),
                ("Fixture-IN-ISP-B", "IN", True),
                ("Fixture-US-East", "US", False),
                ("Fixture-EU-Frankfurt", "DE", False),
            ]
        ):
            status = 451 if scenario == "regional" and domestic else 200
            if scenario == "outage":
                status = 500
            if scenario == "inconclusive" and i == 0:
                status = 403 if attempt == 1 else 200
            rows.append(
                ProbeTelemetry(
                    vantage_point=name,
                    country_code=country,
                    is_domestic=domestic,
                    egress_type=EgressType.MockFixture,
                    http_status=status,
                    dns_resolved=True,
                    dom_signature_matched=BLOCK_TOKENS[0] if status == 451 else None,
                    response_time_ms=82.5 + i * 43 + attempt * 7,
                    timestamp=utcnow(),
                    is_simulation=True,
                    error=None,
                    attempt=attempt,
                )
            )
    return rows


async def run_multi_vantage_check(target_url: str, settings: Settings | None = None) -> ProbeResult:
    settings = settings or get_settings()
    target_url = validate_target(target_url)
    nodes = configured_vantages(settings)
    if not nodes:
        log.warning(
            "MOCK FIXTURE: is_simulation=True; no target contacted; scenario=%s", settings.mock_scenario
        )
        rows = mock_rows(settings.mock_scenario)
        return ProbeResult(classify(rows), rows, True)
    await asyncio.wait_for(ensure_public_destination(target_url), timeout=settings.probe_timeout_seconds)
    # Repeat to retain inconsistent/flaky responses instead of choosing the favorable sample.
    rows = []
    for attempt in (1, 2):
        rows.extend(
            await asyncio.gather(*(probe_once(target_url, node, settings, attempt) for node in nodes))
        )
    return ProbeResult(classify(rows), rows, False)
