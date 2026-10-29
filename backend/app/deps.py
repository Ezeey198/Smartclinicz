import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User
from .roles import module_level
from .subscriptions import is_expired

bearer = HTTPBearer(auto_error=False)
# While a clinic's subscription is expired, only the clinic admin can reach these (to renew).
ADMIN_WHEN_EXPIRED = ("/api/auth/", "/api/subscription", "/api/wallet", "/api/clinic/profile")


def current_user(request: Request, creds=Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(401, "Please sign in.")
    try:
        data = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    user = db.get(User, int(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "Your account is inactive.")
    if user.clinic_id:
        if user.clinic.status != "active":
            raise HTTPException(403, "This clinic is not active.")
        if is_expired(user.clinic):
            path = request.url.path
            if not (path.startswith("/api/auth/me") or (user.role == "admin" and path.startswith(ADMIN_WHEN_EXPIRED))):
                raise HTTPException(402, "subscription_expired")
    return user


def superadmin_only(user: User = Depends(current_user)) -> User:
    if not user.is_superadmin:
        raise HTTPException(403, "Only the superadmin can do this.")
    return user


def clinic_admin_only(user: User = Depends(current_user)) -> User:
    if user.is_superadmin or user.role != "admin":
        raise HTTPException(403, "Only the clinic admin can do this.")
    return user


def clinic_member(user: User = Depends(current_user)) -> User:
    if user.is_superadmin:
        raise HTTPException(403, "Superadmin accounts do not belong to a clinic.")
    return user


def module_guard(module: str, write: bool = False):
    def dep(user: User = Depends(clinic_member)) -> User:
        level = module_level(user.clinic.clinic_class, user.role, module)
        if level is None:
            raise HTTPException(403, "Your role cannot open this module.")
        if write and level != "write":
            raise HTTPException(403, "Your role has view-only access to this module.")
        return user
    return dep
