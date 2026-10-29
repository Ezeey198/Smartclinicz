
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .migrate import ensure_columns, grandfather_trials
from .routers import (
    activity,
    auth,
    clinic,
    finance,
    hr,
    patient_file,
    payments,
    records,
    stock,
    subscription,
    superadmin,
    wallet,
)
from .seed import seed_superadmin


# ---------------------------------------------------------
# APPLICATION LIFESPAN
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize the database, run migrations, seed the
    superadmin account, and report email configuration.
    """

    # Create database tables.
    Base.metadata.create_all(engine)

    # Apply database updates.
    ensure_columns()

    # Apply trial-related updates.
    grandfather_trials()

    # Create the superadmin if it does not already exist.
    with SessionLocal() as db:
        if seed_superadmin(db):
            print(
                f"Superadmin created: {settings.SUPERADMIN_EMAIL}"
            )

    # Report email configuration.
    from .emailer import smtp_configured

    if smtp_configured():
        print(
            f"Email: sending through "
            f"{settings.SMTP_HOST}:{settings.SMTP_PORT}"
        )
    else:
        print(
            "Email: SMTP_HOST is empty, so emails are only "
            "stored in the Email outbox (superadmin)."
        )

    # Report the frontend URL used in email links.
    print(f"Links in emails open: {settings.FRONTEND_URL}")

    yield


# ---------------------------------------------------------
# CREATE FASTAPI APPLICATION
# ---------------------------------------------------------
app = FastAPI(
    title="ClinicPro API",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------
# CORS CONFIGURATION
# ---------------------------------------------------------
# Explicitly allow the deployed frontend and local development.
# Do not use "*" for origins when credentials are enabled.
ALLOWED_ORIGINS = [
    "https://smartclinicz-s8pb.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# REGISTER API ROUTERS
# ---------------------------------------------------------
API_ROUTERS = [
    auth.router,
    superadmin.router,
    clinic.router,
    finance.router,
    hr.router,
    patient_file.router,
    wallet.router,
    subscription.router,
    activity.router,
    stock.router,
    payments.router,
    *records.routers,
]

for router in API_ROUTERS:
    app.include_router(
        router,
        prefix="/api",
    )


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------
@app.get("/api/health", tags=["Health"])
def health():
    """
    Check whether the API is responding.
    """
    return {"status": "ok"}