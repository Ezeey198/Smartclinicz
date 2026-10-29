import os
import secrets
from pathlib import Path

from dotenv import load_dotenv


# Load environment variables for local development.
load_dotenv()


def _secret_key() -> str:
    """
    Load a secure application secret.

    Production:
        SECRET_KEY must be explicitly configured in the environment.

    Local development:
        Reuse backend/.secret_key or generate a new key.
    """
    key = os.getenv("SECRET_KEY", "").strip()

    if len(key) >= 32:
        return key

    if os.getenv("VERCEL") == "1":
        raise RuntimeError(
            "SECRET_KEY must be configured in the production "
            "environment and must contain at least 32 characters."
        )

    secret_file = Path(__file__).resolve().parent.parent / ".secret_key"

    if secret_file.exists():
        saved_key = secret_file.read_text(encoding="utf-8").strip()

        if len(saved_key) >= 32:
            return saved_key

    key = secrets.token_urlsafe(48)

    secret_file.parent.mkdir(parents=True, exist_ok=True)
    secret_file.write_text(key, encoding="utf-8")

    return key


def _env_int(name: str, default: int) -> int:
    """Read an integer environment variable."""
    return int(os.getenv(name, str(default)).strip())


def _env_float(name: str, default: float) -> float:
    """Read a floating-point environment variable."""
    return float(os.getenv(name, str(default)).strip())


def _env_bool(name: str, default: bool = False) -> bool:
    """Read a boolean environment variable."""
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env(name: str, default: str = "") -> str:
    """Read and trim a string environment variable."""
    return os.getenv(name, default).strip()


class Settings:
    """Central application configuration."""

    # ---------------------------------------------------------
    # Security and authentication
    # ---------------------------------------------------------

    SECRET_KEY = _secret_key()
    ALGORITHM = "HS256"

    TOKEN_HOURS = _env_int("TOKEN_HOURS", 12)
    INVITE_DAYS = _env_int("INVITE_DAYS", 7)

    # ---------------------------------------------------------
    # Application URLs
    # ---------------------------------------------------------

    FRONTEND_URL = _env(
        "FRONTEND_URL",
        "http://localhost:5173",
    ).rstrip("/")

    PUBLIC_API_URL = _env(
        "PUBLIC_API_URL",
        "",
    ).rstrip("/")

    # ---------------------------------------------------------
    # Database
    # ---------------------------------------------------------

    # For production, configure DATABASE_URL with your actual
    # PostgreSQL connection string in Vercel.
    #
    # SQLite is retained as a local-development fallback.
    DATABASE_URL = _env(
        "DATABASE_URL",
        "sqlite:///./clinic.db",
    )

    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace(
            "postgres://",
            "postgresql://",
            1,
        )

    # ---------------------------------------------------------
    # Superadmin bootstrap settings
    # ---------------------------------------------------------

    SUPERADMIN_NAME = _env(
        "SUPERADMIN_NAME",
        "System Administrator",
    )

    SUPERADMIN_EMAIL = _env(
        "SUPERADMIN_EMAIL",
        "admin@example.com",
    ).lower()

    SUPERADMIN_PASSWORD = _env(
        "SUPERADMIN_PASSWORD",
        "",
    )

    # ---------------------------------------------------------
    # Subscription settings
    # ---------------------------------------------------------

    SUBSCRIPTION_PRICE = _env_float(
        "SUBSCRIPTION_PRICE",
        1000,
    )

    SUBSCRIPTION_HOURS = _env_int(
        "SUBSCRIPTION_HOURS",
        24,
    )

    TRIAL_HOURS = _env_float(
        "TRIAL_HOURS",
        2,
    )

    # ---------------------------------------------------------
    # Payment mode
    # ---------------------------------------------------------

    PAYMENT_MODE = _env(
        "PAYMENT_MODE",
        "simulated",
    ).lower()

    if PAYMENT_MODE not in {"simulated", "live"}:
        raise ValueError(
            "PAYMENT_MODE must be 'simulated' or 'live'."
        )

    PHONE_COUNTRY_CODE = _env(
        "PHONE_COUNTRY_CODE",
        "256",
    )

    # ---------------------------------------------------------
    # MTN Mobile Money Collections
    # ---------------------------------------------------------

    MTN_BASE_URL = _env(
        "MTN_BASE_URL",
        "https://sandbox.momodeveloper.mtn.com",
    ).rstrip("/")

    MTN_TARGET_ENV = _env(
        "MTN_TARGET_ENV",
        "sandbox",
    )

    MTN_CURRENCY = _env(
        "MTN_CURRENCY",
        "EUR",
    ).upper()

    MTN_SUBSCRIPTION_KEY = _env(
        "MTN_SUBSCRIPTION_KEY",
        "",
    )

    MTN_API_USER = _env(
        "MTN_API_USER",
        "",
    )

    MTN_API_KEY = _env(
        "MTN_API_KEY",
        "",
    )

    # ---------------------------------------------------------
    # Airtel Money
    # ---------------------------------------------------------

    AIRTEL_BASE_URL = _env(
        "AIRTEL_BASE_URL",
        "https://openapiuat.airtel.africa",
    ).rstrip("/")

    AIRTEL_CLIENT_ID = _env(
        "AIRTEL_CLIENT_ID",
        "",
    )

    AIRTEL_CLIENT_SECRET = _env(
        "AIRTEL_CLIENT_SECRET",
        "",
    )

    AIRTEL_COUNTRY = _env(
        "AIRTEL_COUNTRY",
        "UG",
    ).upper()

    AIRTEL_CURRENCY = _env(
        "AIRTEL_CURRENCY",
        "UGX",
    ).upper()

       # ---------------------------------------------------------
    # Email / SMTP
    # ---------------------------------------------------------

    SMTP_HOST = _env("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = _env_int("SMTP_PORT", 587)

    # Support both old and new environment variable names.
    SMTP_USERNAME = _env("SMTP_USERNAME", _env("SMTP_USER"))
    SMTP_USER = _env("SMTP_USER", SMTP_USERNAME)

    SMTP_PASSWORD = _env("SMTP_PASSWORD", _env("SMTP_PASS"))
    SMTP_PASS = _env("SMTP_PASS", SMTP_PASSWORD)

    SMTP_FROM_EMAIL = _env(
        "SMTP_FROM_EMAIL",
        _env("SMTP_FROM", SMTP_USERNAME),
    )

    SMTP_FROM = _env("SMTP_FROM", SMTP_FROM_EMAIL)

    # Email connection security.
    SMTP_SECURITY = _env("SMTP_SECURITY", "STARTTLS").upper()

    SMTP_USE_TLS = _env_bool(
        "SMTP_USE_TLS",
        SMTP_SECURITY == "STARTTLS",
    )

    SMTP_USE_SSL = _env_bool(
        "SMTP_USE_SSL",
        SMTP_SECURITY == "SSL",
    )

    # ---------------------------------------------------------
    # General application settings
    # ---------------------------------------------------------

    APP_NAME = _env("APP_NAME", "Smartclinicz")
    DEBUG = _env_bool("DEBUG", False)


# Shared configuration instance imported by the application.
    settings = Settings()

    # ---------------------------------------------------------
    # General application settings
    # ---------------------------------------------------------

    APP_NAME = _env(
        "APP_NAME",
        "Smartclinicz",
    )

    DEBUG = _env_bool(
        "DEBUG",
        False,
    )


# Shared configuration instance imported by the application.
settings = Settings()