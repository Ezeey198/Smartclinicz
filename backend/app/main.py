from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, SessionLocal, engine
from .migrate import ensure_columns, grandfather_trials
from .routers import activity, auth, clinic, finance, hr, patient_file, payments, records, stock, subscription, superadmin, wallet
from .seed import seed_superadmin


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_columns()
    grandfather_trials()
    with SessionLocal() as db:
        if seed_superadmin(db):
            print(f"Superadmin created: {settings.SUPERADMIN_EMAIL}")
    from .emailer import smtp_configured
    print(f"Email: sending through {settings.SMTP_HOST}:{settings.SMTP_PORT}" if smtp_configured() else "Email: SMTP_HOST is empty, so emails are only stored in the Email outbox (superadmin).")
    print(f"Links in emails open: {settings.FRONTEND_URL}")
    yield


app = FastAPI(title="ClinicPro API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in [auth.router, superadmin.router, clinic.router, finance.router, hr.router, patient_file.router, wallet.router, subscription.router, activity.router, stock.router, payments.router, *records.routers]:
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
