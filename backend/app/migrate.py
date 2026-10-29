
"""
Lightweight schema upgrade utilities.

These functions help existing databases accommodate newly added
model columns. For substantial schema changes, use Alembic migrations.
"""

from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Clinic


def ensure_columns():
    """
    Add missing columns to existing tables.

    Existing tables are inspected before adding columns. Tables that
    do not exist are left to Base.metadata.create_all(engine).

    Note:
    This is a lightweight migration helper, not a replacement for
    a full database migration framework.
    """

    with engine.begin() as conn:
        inspector = inspect(conn)
        existing_tables = set(inspector.get_table_names())

        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue

            existing_columns = {
                column["name"]
                for column in inspector.get_columns(table.name)
            }

            for column in table.columns:
                if column.name in existing_columns:
                    continue

                # Generate the database-specific column type.
                column_type = column.type.compile(
                    dialect=conn.dialect
                )

                # Quote identifiers using the active database dialect.
                preparer = conn.dialect.identifier_preparer
                table_name = preparer.quote(table.name)
                column_name = preparer.quote(column.name)

                statement = (
                    f"ALTER TABLE {table_name} "
                    f"ADD COLUMN {column_name} {column_type}"
                )

                conn.execute(text(statement))

                # Prevent duplicate additions during this execution.
                existing_columns.add(column.name)


def grandfather_trials():
    """
    Give eligible previously approved clinics a trial period.

    Only clinics that have been approved and do not currently have
    an active_until value are updated.

    This preserves the existing application behavior. For guaranteed
    one-time trial grants, store a separate trial-granted timestamp
    or use an explicit data migration.
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

        for clinic in clinics:
            clinic.active_until = trial_expiry

        db.commit()