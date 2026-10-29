
"""
Lightweight schema upgrade utilities.

Adds missing model columns to existing tables and grants trials
to eligible clinics. For production schema evolution, use Alembic
or another controlled migration framework.
"""

from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Clinic


def ensure_columns():
    """
    Add missing columns to existing tables.

    Tables that do not exist are created by Base.metadata.create_all()
    during application startup.

    This function does not migrate existing column types, constraints,
    indexes, or data.
    """

    with engine.begin() as conn:
        inspector = inspect(conn)
        existing_tables = set(inspector.get_table_names())

        preparer = conn.dialect.identifier_preparer

        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue

            existing_columns = {
                column["name"]
                for column in inspector.get_columns(table.name)
            }

            quoted_table = preparer.quote(table.name)

            for column in table.columns:
                if column.name in existing_columns:
                    continue

                # Compile the SQL type for the current database dialect.
                column_type = column.type.compile(
                    dialect=conn.dialect
                )

                quoted_column = preparer.quote(column.name)

                statement = (
                    f"ALTER TABLE {quoted_table} "
                    f"ADD COLUMN {quoted_column} {column_type}"
                )

                conn.execute(text(statement))
                existing_columns.add(column.name)


def grandfather_trials():
    """
    Grant a trial to approved clinics that do not yet have an
    active_until timestamp.

    IMPORTANT:
    This retains the existing eligibility rules. It does not
    independently record whether a clinic received a trial before.
    For a guaranteed one-time grant, implement a separate migration
    marker or trial-granted timestamp.
    """

    trial_expiry = datetime.utcnow() + timedelta(
        hours=settings.TRIAL_HOURS
    )

    with SessionLocal() as db:
        clinics = (
            db.query(Clinic)
            .filter(
                Clinic.approved_at.isnot(None),
                Clinic.active_until.is_(None),
            )
            .all()
        )

        if not clinics:
            return

        for clinic in clinics:
            clinic.active_until = trial_expiry

        db.commit()