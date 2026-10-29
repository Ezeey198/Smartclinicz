import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _secret_key() -> str:
    """
    Load a sufficiently long SECRET_KEY from the environment.

    For local development, generate and reuse a key in
    backend/.secret_key if no valid environment key exists.

    In production, configure SECRET_KEY explicitly.
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
    return int(os.getenv(name, str(default)).strip())


def _env_float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)).strip())


class Settings:
    SECRET_KEY = _secret_key()
    ALGORITHM = "HS256"

    TOKEN_HOURS = _env_int("TOKEN_HOURS", 12)
    INVITE_DAYS = _env_int("INVITE_DAYS", 7)

    # Subscription settings
    SUBSCRIPTION_PRICE = _env_float("SUBSCRIPTION_PRICE", 1000)
    SUBSCRIPTION_HOURS = _env_int("SUBSCRIPTION_HOURS", 24)
    TRIAL_HOURS = _env_float("TRIAL_HOURS", 2)

    # Payment mode
    PAYMENT_MODE = os.getenv(
        "PAYMENT_MODE", "simulated"
    ).strip().lower()

    if PAYMENT_MODE not in {"simulated", "live"}:
        raise ValueError(
            "PAYMENT_MODE must be 'simulated' or 'live'."
        )

    PUBLIC_API_URL = os.getenv(
        "PUBLIC_API_URL", ""
    ).strip().rstrip("/")

    PHONE_COUNTRY_CODE = os.getenv(
        "PHONE_COUNTRY_CODE", "256"
    ).strip()

    # MTN MoMo Collections
    MTN_BASE_URL = os.getenv(
        "MTN_BASE_URL",
        "https://sandbox.momodeveloper.mtn.com",
    ).strip().rstrip("/")

    MTN_TARGET_ENV = os.getenv(
        "MTN_TARGET_ENV", "sandbox"
    ).strip()

    MTN_CURRENCY = os.getenv(
        "MTN_CURRENCY", "EUR"
    ).strip().upper()

    MTN_SUBSCRIPTION_KEY = os.getenv(
        "MTN_SUBSCRIPTION_KEY", ""
    ).strip()

    MTN_API_USER = os.getenv(
        "MTN_API_USER", ""
    ).strip()

    MTN_API_KEY = os.getenv(
        "MTN_API_KEY", ""
    ).strip()

    # Airtel Money
    AIRTEL_BASE_URL = os.getenv(
        "AIRTEL_BASE_URL",
        "https://openapiuat.air