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


REMOVED_ROLES = ("cashier", "records_officer", "store_keeper", "hr_manager")


def retire_removed_roles():
    """Cashier, records officer, store keeper and HR manager no longer exist. Anyone still holding one is deactivated
    so the clinic admin can move them to a current role. Existing clinics keep any custom role they already use."""
    from .models import User
    from .roles import custom_roles
    import json
    with SessionLocal() as db:
        for u in db.query(User).filter(User.role.in_(REMOVED_ROLES)):
            u.is_active = False
        for c in db.query(Clinic).filter(Clinic.extra_roles.is_(None)):
            used = {u.role for u in c.users}
            c.extra_roles = json.dumps([r for r in custom_roles(c.clinic_class) if r in used])
        db.commit()


def grandfather_trials():
    """Clinics approved before subscriptions existed get a fresh trial period."""
    with SessionLocal() as db:
        for c in db.query(Clinic).filter(Clinic.approved_at.isnot(None), Clinic.active_until.is_(None)):
            c.active_until = datetime.utcnow() + timedelta(hours=settings.TRIAL_HOURS)
        db.commit()
