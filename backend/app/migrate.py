"""Tiny schema upgrade so an existing database keeps working after new columns are added."""
from datetime import datetime, timedelta
from sqlalchemy import inspect, text
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Clinic


def ensure_columns():
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have:
                    conn.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"))


def grandfather_trials():
    """Clinics approved before subscriptions existed get a fresh trial period."""
    with SessionLocal() as db:
        for c in db.query(Clinic).filter(Clinic.approved_at.isnot(None), Clinic.active_until.is_(None)):
            c.active_until = datetime.utcnow() + timedelta(hours=settings.TRIAL_HOURS)
        db.commit()
