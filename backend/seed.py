"""Creates the database tables and the superadmin account (from .env). Nothing else.
Run from the backend folder:  python seed.py
The same thing happens automatically when the API starts, so running this is optional."""
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.seed import seed_superadmin

Base.metadata.create_all(engine)
with SessionLocal() as db:
    made = seed_superadmin(db)
print(("Superadmin created: " if made else "Superadmin already exists: ") + settings.SUPERADMIN_EMAIL)
print("Sign in at the Superadmin tab, register a clinic, and the clinic admin creates all other users.")
