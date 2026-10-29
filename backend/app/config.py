import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


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
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./clinic.db")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_SECURITY = os.getenv("SMTP_SECURITY", "starttls").lower()  # starttls (587) | ssl (465) | none
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "ClinicPro <no-reply@clinicpro.local>")
    SUPERADMIN_NAME = os.getenv("SUPERADMIN_NAME", "System Administrator")
    SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@clinicpro.local")
    SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "ChangeMe123!")


settings = Settings()
