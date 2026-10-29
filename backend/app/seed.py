"""The only account created by the system itself is the superadmin. Everything else is created in the app."""
from sqlalchemy.orm import Session
from .config import settings
from .models import User
from .security import hash_password


def seed_superadmin(db: Session) -> bool:
    if db.query(User).filter(User.is_superadmin.is_(True)).first():
        return False
    db.add(User(full_name=settings.SUPERADMIN_NAME, email=settings.SUPERADMIN_EMAIL.lower(), role="superadmin",
                is_superadmin=True, is_active=True, password_hash=hash_password(settings.SUPERADMIN_PASSWORD)))
    db.commit()
    return True
