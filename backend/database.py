from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from .config import get_settings
from .models import Base

url = get_settings().database_url
engine = create_engine(
    url, connect_args={"check_same_thread": False, "timeout": 30} if url.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

if url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    with SessionLocal() as session:
        yield session
