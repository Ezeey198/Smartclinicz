from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..activity import log
from ..deps import current_user
from ..emailer import deliver, send_account_activation
from ..models import Clinic, User, role_list
from ..notify import flush_sms, notify_roles, notify_superadmins
from ..roles import MODULE_ACCESS, ROLE_LABELS, label_for, module_level
from ..subscriptions import is_expired, sub_state
from ..security import create_token, hash_password, new_link_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
MAX_FAILS = 3          # wrong passwords before an account is locked (the superadmin is never locked)


def me_payload(user: User) -> dict:
    base = {"id": user.id, "full_name": user.full_name, "email": user.email, "phone": user.phone, "avatar": user.avatar, "theme": user.theme or "teal"}
    if user.is_superadmin:
        return {**base, "role": "superadmin", "roles": ["superadmin"], "role_label": "Superadmin", "is_superadmin": True}
    c = user.clinic
    modules = {m: lvl for m in MODULE_ACCESS if (lvl := module_level(c.clinic_class, user.role, m))}
    roles = role_list(user)
    return {**base, "role": str(user.role), "roles": roles, "role_label": " + ".join(label_for(r, c.clinic_class) for r in roles), "is_superadmin": False,
            "clinic": {"id": c.id, "code": c.code, "name": c.name, "clinic_class": c.clinic_class, "status": c.status,
                       "subscription": sub_state(c)},
            "modules": modules}


class LoginIn(BaseModel):
    clinic_code: str | None = None
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    clinic = None
    if body.clinic_code and body.clinic_code.strip():
        clinic = db.query(Clinic).filter(Clinic.code == body.clinic_code.strip().upper()).first()
        user = clinic and db.query(User).filter(User.clinic_id == clinic.id, User.email == email).first()
    else:
        user = db.query(User).filter(User.is_superadmin.is_(True), User.email == email).first()
    if user and not user.password_hash:
        raise HTTPException(403, "Your account is not active yet. Open the activation link we emailed you.")
    if user and not user.is_superadmin and user.locked_at:
        raise HTTPException(423, "This account is locked after 3 wrong passwords. Your clinic admin has been alerted and can email you a link to set a new password.")
    if not user or not verify_password(body.password, user.password_hash):
        if user and not user.is_superadmin:
            locked = _failed_login(db, user)
            if locked:
                raise HTTPException(423, "That was the third wrong password, so this account is now locked. Your clinic admin has been alerted and can email you a link to set a new password.")
        raise HTTPException(401, "Wrong clinic code, email or password.")
    if not user.is_active:
        raise HTTPException(403, "Your account is inactive. Ask your clinic admin to reactivate it.")
    if clinic and clinic.status == "pending":
        raise HTTPException(403, "This clinic is not approved yet. The clinic admin must approve it from the email we sent.")
    if clinic and clinic.status == "suspended":
        raise HTTPException(403, "This clinic has been deactivated by the system administrator. Contact them to have it activated.")
    if clinic and clinic.status == "active" and user.role != "admin" and is_expired(clinic):
        raise HTTPException(403, "This clinic's subscription has ended. The clinic admin must renew it before staff can sign in.")
    if user.failed_logins:
        user.failed_logins = 0
        db.commit()
    return {"token": create_token(user.id), "user": me_payload(user)}


def _failed_login(db, user) -> bool:
    """Counts a wrong password. On the third the account is locked, the admin is alerted (page + SMS), and an email goes out.
    Returns True when the account has just been locked."""
    user.failed_logins = (user.failed_logins or 0) + 1
    log(db, user, "security", "failed_login", f"Failed sign-in for {user.full_name} (attempt {user.failed_logins} of {MAX_FAILS})")
    locked = user.failed_logins >= MAX_FAILS
    if locked:
        c = user.clinic
        user.locked_at = datetime.utcnow()
        who = f"{user.full_name} ({label_for(user.role, c.clinic_class)})"
        if user.role == "admin":
            # An admin account was locked: supervision alert + email to the superadmin, and the admin gets a reset link straight away.
            body = f"The clinic admin {user.full_name} of {c.name} ({c.code}) failed to sign in {MAX_FAILS} times and the account is locked."
            notify_superadmins(db, "Supervision alert: admin account locked", body, link="/super")
            link = f"{settings.FRONTEND_URL}/superadmin"
            from ..models import User as U
            for sa in db.query(U).filter(U.is_superadmin.is_(True), U.is_active.is_(True)).all():
                deliver(db, sa.email, f"Supervision alert: admin account locked at {c.name}", "Admin account locked", [f"Hello {sa.full_name},", body, "Open the system to review."], "Open ClinicPro", link)
            user.activation_token = new_link_token()
            user.token_expires = datetime.utcnow() + timedelta(days=settings.INVITE_DAYS)
            db.commit()
            send_account_activation(db, user, c)
        else:
            notify_roles(db, c.id, ["admin"], "Account locked after failed sign-ins",
                         f"{who} failed to sign in {MAX_FAILS} times and the account is locked. Open Staff and email them a link to set a new password.", link="/app/staff", kind="security")
    db.commit()
    flush_sms()
    return locked


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
    u.failed_logins, u.locked_at = 0, None            # choosing a new password unlocks the account
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
    user.failed_logins, user.locked_at = 0, None
    db.commit()
    return {"ok": True}
