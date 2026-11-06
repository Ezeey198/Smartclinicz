import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str = "") -> str:
    """Reads a setting and strips stray spaces and quotes (hosting panels often add them)."""
    return os.getenv(name, default).strip().strip('"').strip("'").strip()


def _db_url() -> str:
    """Hosts hand out postgres:// URLs; SQLAlchemy needs the driver named."""
    u = _env("DATABASE_URL", "sqlite:///./clinic.db")
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://"):]
    if u.startswith("postgresql://"):
        u = "postgresql+psycopg://" + u[len("postgresql://"):]
    return u


def _secret_key() -> str:
    """Use SECRET_KEY from .env when it is long enough; otherwise create and reuse a strong one."""
    key = os.getenv("SECRET_KEY", "")
    if len(key) >= 32:
        return key
    f = Path(__file__).resolve().parent.parent / ".secret_key"
    if f.exists() and len(f.read_text().strip()) >= 32:
        return f.read_text().strip()
    key = secrets.token_urlsafe(48)
    f.write_text(key)
    return key


APP_VERSION = "2026-11-05.1"   # keep equal to frontend/src/version.js


class Settings:
    SECRET_KEY = _secret_key()
    ALGORITHM = "HS256"
    TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "12"))
    INVITE_DAYS = int(os.getenv("INVITE_DAYS", "7"))
    SUBSCRIPTION_PRICE = float(os.getenv("SUBSCRIPTION_PRICE", "1000"))   # UGX per period
    SUBSCRIPTION_HOURS = int(os.getenv("SUBSCRIPTION_HOURS", "24"))       # length of one paid period
    TRIAL_HOURS = float(os.getenv("TRIAL_HOURS", "2"))                    # free time after a clinic is approved
    PAYMENT_MODE = os.getenv("PAYMENT_MODE", "simulated")                 # simulated | live
    PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "").rstrip("/")          # https address of this API, lets providers call back
    PHONE_COUNTRY_CODE = os.getenv("PHONE_COUNTRY_CODE", "256")
    # MTN MoMo Collections
    MTN_BASE_URL = os.getenv("MTN_BASE_URL", "https://sandbox.momodeveloper.mtn.com").rstrip("/")
    MTN_TARGET_ENV = os.getenv("MTN_TARGET_ENV", "sandbox")               # sandbox | mtnuganda
    MTN_CURRENCY = os.getenv("MTN_CURRENCY", "EUR")                       # the MTN sandbox only accepts EUR; use UGX in production
    MTN_SUBSCRIPTION_KEY = os.getenv("MTN_SUBSCRIPTION_KEY", "")
    MTN_API_USER = os.getenv("MTN_API_USER", "")
    MTN_API_KEY = os.getenv("MTN_API_KEY", "")
    # Airtel Money
    AIRTEL_BASE_URL = os.getenv("AIRTEL_BASE_URL", "https://openapiuat.airtel.africa").rstrip("/")
    AIRTEL_CLIENT_ID = os.getenv("AIRTEL_CLIENT_ID", "")
    AIRTEL_CLIENT_SECRET = os.getenv("AIRTEL_CLIENT_SECRET", "")
    AIRTEL_COUNTRY = os.getenv("AIRTEL_COUNTRY", "UG")
    AIRTEL_CURRENCY = os.getenv("AIRTEL_CURRENCY", "UGX")
    DATABASE_URL = _db_url()
    FRONTEND_URL = _env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    # Extra websites allowed to call this API, comma separated (the FRONTEND_URL is always allowed). "*" allows any site.
    CORS_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
    CORS_ORIGIN_REGEX = _env("CORS_ORIGIN_REGEX")   # e.g. https://.*\.vercel\.app to also allow preview deployments
    SMTP_HOST = _env("SMTP_HOST")
    SMTP_PORT = int(_env("SMTP_PORT", "587") or 587)
    SMTP_SECURITY = (_env("SMTP_SECURITY", "starttls") or "starttls").lower()  # starttls (587) | ssl (465) | none
    SMTP_USER = _env("SMTP_USER")
    SMTP_PASSWORD = _env("SMTP_PASSWORD")
    SMTP_FROM = _env("SMTP_FROM", "ClinicPro <no-reply@clinicpro.local>")
    SUPERADMIN_NAME = os.getenv("SUPERADMIN_NAME", "System Administrator")
    SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@clinicpro.local")
    SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "ChangeMe123!")


settings = Settings()
if "gmail" in settings.SMTP_HOST.lower():
    settings.SMTP_PASSWORD = settings.SMTP_PASSWORD.replace(" ", "")   # Google shows app passwords in groups of four

