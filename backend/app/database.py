from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import settings


def _normalize_database_url(url: str) -> str:
    """
    Normalize PostgreSQL URLs supplied by hosting providers.
    Keep SQLite URLs unchanged.
    """
    url = url.strip()

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    return url


DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)

# SQLite requires check_same_thread=False when used by FastAPI.
connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

# Use conservative connection pooling settings.
# For SQLite, preserve SQLAlchemy's normal SQLite pooling behavior.
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=3,
        pool_recycle=1800,
    )


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    """
    Provide a database session to FastAPI endpoints
    and close it after the request finishes.
    """
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
