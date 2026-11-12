"""ClinicPro API: the file that starts the application.

Built so that one problem cannot turn the whole API into a blank "500 FUNCTION_INVOCATION_FAILED" page:
  * every router is loaded on its own; if one cannot start, the rest keep working and the reason is reported,
  * the database is prepared on the first request (and again if it was down), never at import time,
  * /api/health always answers and says what is wrong, so a problem can be read in a browser.
"""
import importlib
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .config import APP_VERSION, settings

PACKAGE = __package__ or "app"

# What went wrong while starting, if anything. Shown by /api/health.
STATE = {"database": "not started yet", "problems": [], "uploads": False}
_lock = threading.Lock()
_db_ready = False
_last_try = 0.0


def _problem(text: str) -> None:
    STATE["problems"].append(text)
    print("STARTUP PROBLEM:", text, flush=True)


def init_database() -> bool:
    """Creates the tables, adds any new columns and creates the superadmin. Safe to call many times, and from many servers at once."""
    global _db_ready, _last_try
    if _db_ready:
        return True
    with _lock:
        if _db_ready:
            return True
        if time.time() - _last_try < 20:      # do not hammer a database that is down
            return False
        _last_try = time.time()
        error = None
        for attempt in range(2):              # two servers starting together can collide on "already exists": just try again
            try:
                from . import models  # noqa: F401  (registers every table)
                from .database import Base, SessionLocal, engine
                from .migrate import ensure_columns, grandfather_trials, retire_removed_roles
                from .seed import seed_superadmin
                Base.metadata.create_all(engine)
                ensure_columns()
                grandfather_trials()
                retire_removed_roles()
                with SessionLocal() as db:
                    if seed_superadmin(db):
                        print(f"Superadmin created: {settings.SUPERADMIN_EMAIL}", flush=True)
                _db_ready, error = True, None
                break
            except Exception as e:
                error = f"{type(e).__name__}: {str(e)[:300]}"
                time.sleep(1)
        STATE["database"] = "ok" if _db_ready else f"error: {error}"
        if error:
            print("DATABASE PROBLEM:", error, flush=True)
        return _db_ready


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .emailer import smtp_configured
    print(f"ClinicPro API {APP_VERSION}", flush=True)
    print(f"Email: sending through {settings.SMTP_HOST}:{settings.SMTP_PORT}" if smtp_configured() else "Email: SMTP_HOST is empty, so emails are only stored in the Email outbox (superadmin).", flush=True)
    print(f"Links in emails open: {settings.FRONTEND_URL}", flush=True)
    print(f"Websites allowed to use this API: {'any' if _any else ', '.join(sorted(_origins))}", flush=True)
    if settings.DATABASE_URL.startswith("sqlite") and not settings.FRONTEND_URL.startswith("http://localhost"):
        print("WARNING: SQLite on a hosting service can lose its data when the service restarts. Use PostgreSQL (set DATABASE_URL).", flush=True)
    try:
        await run_in_threadpool(init_database)
    except Exception as e:                    # never stop the app from starting
        print("DATABASE PROBLEM:", e, flush=True)
    yield


app = FastAPI(title="ClinicPro API", version=APP_VERSION, lifespan=lifespan)


async def prepare_database(request: Request, call_next):
    """Makes sure the database is ready before the first real request (serverless hosts may never run the startup step)."""
    if not _db_ready and request.method != "OPTIONS":
        await run_in_threadpool(init_database)
    return await call_next(request)


app.middleware("http")(prepare_database)

# CORS goes on last so it is the outermost layer and its headers are on every answer.
_origins = {settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173", *settings.CORS_ORIGINS}
_any = "*" in _origins   # sign-in uses a bearer token, not cookies, so allowing every website is safe if you choose to
app.add_middleware(CORSMiddleware, allow_origins=["*"] if _any else sorted(_origins), allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
                   allow_credentials=not _any, allow_methods=["*"], allow_headers=["*"])


def _load(name: str):
    try:
        return importlib.import_module(f".routers.{name}", package=PACKAGE)
    except Exception as e:
        _problem(f"'{name}' could not start: {type(e).__name__}: {str(e)[:300]}")
        return None


ROUTERS = ["auth", "superadmin", "clinic", "finance", "patient_file", "wallet", "subscription", "activity", "stock", "payments",
           "stamps", "cases", "pharmacy", "public", "public_page"]
for _name in ROUTERS:
    _mod = _load(_name)
    if _mod:
        app.include_router(_mod.router, prefix="/api")

_records = _load("records")             # the clinical modules: patients, appointments, lab, billing, ...
if _records:
    for _r in _records.routers:
        app.include_router(_r, prefix="/api")

_uploads = _load("public_uploads")      # photo and video uploads need the python-multipart package
if _uploads:
    app.include_router(_uploads.router, prefix="/api")
    STATE["uploads"] = True
else:
    def _uploads_off():
        raise HTTPException(503, "Uploads are switched off because the server is missing the python-multipart package. Add it to requirements.txt and redeploy.")
    for _p in ("photos", "videos"):
        app.add_api_route(f"/api/clinic/public/{_p}", _uploads_off, methods=["POST"])


@app.get("/")
def root():
    return {"app": "ClinicPro API", "version": APP_VERSION, "health": "/api/health", "docs": "/docs"}


@app.get("/api/health")
async def health():
    await run_in_threadpool(init_database)
    stamp_types = []
    try:
        from .routers.stamps import DOCS
        stamp_types = sorted(DOCS)
    except Exception:
        pass
    ok = STATE["database"] == "ok" and not STATE["problems"]
    return {"status": "ok" if ok else "degraded", "version": APP_VERSION, "database": STATE["database"], "uploads": STATE["uploads"],
            "problems": STATE["problems"], "stamp_types": stamp_types, "case_workflow": True}
