"""Tiny schema upgrade so an existing database keeps working after new columns are added."""
from datetime import datetime, timedelta
from sqlalchemy import inspect, text
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Clinic


def ensure_columns():
    """Adds columns that older databases do not have yet. Each change is separate, so one that already exists never blocks the others."""
    insp = inspect(engine)
    pg = engine.dialect.name == "postgresql"
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have:
                continue
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {'IF NOT EXISTS ' if pg else ''}{col.name} {col.type.compile(engine.dialect)}"
            try:
                with engine.begin() as conn:
                    conn.execute(text(ddl))
            except Exception as e:      # another server may have added it a moment ago
                if col.name not in {c["name"] for c in inspect(engine).get_columns(table.name)}:
                    raise e


def grandfather_trials():
    """Clinics approved before subscriptions existed get a fresh trial period."""
    with SessionLocal() as db:
        for c in db.query(Clinic).filter(Clinic.approved_at.isnot(None), Clinic.active_until.is_(None)):
            c.active_until = datetime.utcnow() + timedelta(hours=settings.TRIAL_HOURS)
        db.commit()
