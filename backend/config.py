from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / "backend" / ".env", extra="ignore")
    database_url: str = f"sqlite:///{(ROOT / 'backend' / 'evidence.sqlite3').as_posix()}"
    embedded_worker: bool = True
    probe_mode: str = "auto"
    mock_scenario: str = "regional"
    vantage_config: str = ""
    probe_timeout_seconds: float = Field(default=12, gt=0, le=30)
    worker_poll_seconds: float = Field(default=2, gt=0)
    worker_lease_seconds: int = Field(default=300, ge=120)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
