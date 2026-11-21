import hashlib, hmac, os, secrets
from datetime import datetime, timedelta, timezone
import jwt
from .config import settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        salt_hex, dk_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def new_link_token() -> str:
    return secrets.token_urlsafe(32)
