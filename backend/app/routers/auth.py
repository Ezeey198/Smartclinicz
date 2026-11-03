from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..deps import current_user
from ..models import Clinic, User
from ..roles import MODULE_ACCESS, ROLE_LABELS, label_for, module_level
from ..subscriptions import is_expired, sub_state
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def me_payload(user: User) -> dict:
    base = {"id": user.id, "full_name": user.full_name, "email": user.email, "phone": user.phone}
    if user.is_superadmin:
        return {**base, "role": "superadmin", "role_label": "Superadmin", "is_superadmin": True}
    c = user.clinic
    modules = {m: lvl for m in MODULE_ACCESS if (lvl := module_level(c.clinic_class, user.role, m))}
    return {**base, "role": user.role, "role_label": label_for(user.role, c.clinic_class), "is_superadmin": False,
            "clinic": {"id": c.id, "code": c.code, "name": c.name, "clinic_class": c.clinic_class, "status": c.status,
                       "subscription": sub_state(c)},
            "modules": modules}


class LoginIn(BaseModel):
    clinic_code: str | None = None   # only needed when the same email and password exist in more than one clinic or pharmacy
    email: str
    password: str


def _problem(u: User):
    """Why this account cannot be used right now, or None."""
    if not u.is_active:
        return "Your account is inactive. Ask your admin to reactivate it."
    c = u.clinic
    if c and c.status == "pending":
        return "This clinic or pharmacy is not approved yet. Its admin must approve it from the email we sent."
    if c and c.status == "suspended":
        return "This clinic or pharmacy has been deactivated by the system administrator. Contact them to have it activated."
    if c and c.status == "active" and u.role != "admin" and is_expired(c):
        return "The subscription has ended. The admin must renew it before staff can sign in."
    return None


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Everybody signs in here with email and password: the superadmin, clinic and pharmacy admins, and all staff.
    The account is found by its email, so no code is needed (a code only helps when one email exists in several places)."""
    email = body.email.strip().lower()
    code = (body.clinic_code or "").strip().upper()
    users = db.query(User).filter(User.email == email).all()
    if code:
        users = [u for u in users if u.is_superadmin or (u.clinic and u.clinic.code == code)]
    hits = [u for u in users if verify_password(body.password, u.password_hash)]
    if not hits:
        if any(not u.password_hash for u in users):
            raise HTTPException(403, "Your account is not active yet. Open the activation link we emailed you.")
        raise HTTPException(401, "Wrong email or password.")
    usable = [u for u in hits if not _problem(u)]
    if not usable:
        raise HTTPException(403, _problem(hits[0]))
    sup = next((u for u in usable if u.is_superadmin), None)
    if sup:
        user = sup
    elif len(usable) == 1:
        user = usable[0]
    else:
        raise HTTPException(409, {"code": "choose_organisation", "choices": [{"code": u.clinic.code, "name": u.clinic.name} for u in usable]})
    return {"token": create_token(user.id), "user": me_payload(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return me_payload(user)


@router.get("/preview/{kind}/{token}")
def preview(kind: str, token: str, db: Session = Depends(get_db)):
    invalid = HTTPException(404, "This link is invalid or has already been used.")
    if kind == "clinic":
        c = db.query(Clinic).filter(Clinic.approval_token == token).first()
        if not c:
            raise invalid
        return {"name": c.name, "code": c.code, "clinic_class": c.clinic_class, "city": c.city,
                "email": c.email, "phone": c.phone, "address": c.address, "registration_number": c.registration_number}
    u = db.query(User).filter(User.activation_token == token).first()
    if not u or (u.token_expires and u.token_expires < datetime.utcnow()):
        raise invalid
    return {"full_name": u.full_name, "email": u.email, "role": label_for(u.role, u.clinic.clinic_class),
            "clinic_name": u.clinic.name, "clinic_code": u.clinic.code, "reset": bool(u.password_hash)}


class TokenIn(BaseModel):
    token: str


@router.post("/approve-clinic")
def approve_clinic(body: TokenIn, db: Session = Depends(get_db)):
    c = db.query(Clinic).filter(Clinic.approval_token == body.token).first()
    if not c:
        raise HTTPException(404, "This link is invalid or has already been used.")
    c.status, c.approved_at, c.approval_token = "active", datetime.utcnow(), None
    c.active_until = datetime.utcnow() + timedelta(hours=settings.TRIAL_HOURS)  # free trial starts at approval
    db.commit()
    return {"clinic_code": c.code, "name": c.name}


class ActivateIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=100)


@router.post("/activate")
def activate(body: ActivateIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.activation_token == body.token).first()
    if not u or (u.token_expires and u.token_expires < datetime.utcnow()):
        raise HTTPException(404, "This link is invalid or has expired. Ask your clinic admin to send a new one.")
    u.password_hash = hash_password(body.password)
    u.is_active, u.activated_at, u.activation_token, u.token_expires = True, datetime.utcnow(), None, None
    db.commit()
    return {"clinic_code": u.clinic.code, "clinic_name": u.clinic.name}


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=100)


@router.post("/change-password")
def change_password(body: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
