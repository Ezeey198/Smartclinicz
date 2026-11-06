from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import APP_VERSION, settings
from .database import Base, SessionLocal, engine
from .migrate import ensure_columns, grandfather_trials
from .routers import activity, auth, cases, clinic, pharmacy, public, public_page, finance, hr, patient_file, payments, records, stamps, stock, subscription, superadmin, wallet
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
    print(f"Websites allowed to use this API: {'any' if _any else ', '.join(sorted(_origins))}")
    if settings.DATABASE_URL.startswith("sqlite") and not settings.FRONTEND_URL.startswith("http://localhost"):
        print("WARNING: SQLite on a hosting service can lose its data when the service restarts. Use PostgreSQL (set DATABASE_URL).")
    yield


app = FastAPI(title="ClinicPro API", version="1.0.0", lifespan=lifespan)
_origins = {settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173", *settings.CORS_ORIGINS}
_any = "*" in _origins   # sign-in uses a bearer token, not cookies, so allowing every site is safe if you choose to
app.add_middleware(CORSMiddleware, allow_origins=["*"] if _any else sorted(_origins), allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
                   allow_credentials=not _any, allow_methods=["*"], allow_headers=["*"])

for r in [auth.router, superadmin.router, clinic.router, finance.router, hr.router, patient_file.router, wallet.router, subscription.router, activity.router, stock.router, payments.router, stamps.router, cases.router, pharmacy.router, public.router, public_page.router, *records.routers]:
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health():
    from .routers.stamps import DOCS
    return {"status": "ok", "version": APP_VERSION, "stamp_types": sorted(DOCS), "case_workflow": True}
