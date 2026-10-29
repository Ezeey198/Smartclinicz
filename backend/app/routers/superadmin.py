import secrets
import string
from datetime import datetime, timedelta
from typing import Literal
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..deps import superadmin_only
from ..emailer import deliver, send_account_activation, send_clinic_approval, smtp_configured
from ..models import CLINIC_DATA, Clinic, EmailOutbox, SubscriptionPayment, User
from ..subscriptions import iso, sub_state
from ..security import new_link_token

router = APIRouter(prefix="/superadmin", tags=["superadmin"], dependencies=[Depends(superadmin_only)])

EDITABLE = ["name", "registration_number", "license_number", "email", "phone", "website",
            "address", "city", "district", "country", "description"]


class ClinicIn(BaseModel):
    name: str = Field(min_length=2)
    clinic_class: Literal["A", "B"]
    registration_number: str | None = None
    license_number: str | None = None
    email: EmailStr
    phone: str
    website: str | None = None
    address: str
    city: str
    district: str | None = None
    country: str
    description: str | None = None
    admin_name: str = Field(min_length=2)
    admin_email: EmailStr
    admin_phone: str | None = None


ALPHABET = "".join(c for c in string.ascii_uppercase if c not in "OI") + "23456789"


def _code(db: Session, cls: str) -> str:
    """A new, never-used clinic code such as CLA-7K3MQ2 (the letter after CL is the class)."""
    while True:
        code = f"CL{cls}-" + "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not db.query(Clinic).filter(Clinic.code == code).first():
            return code


def _row(c: Clinic) -> dict:
    d = {k: getattr(c, k) for k in ["id", "code", "clinic_class", "name", "registration_number", "license_number", "email",
                                    "phone", "website", "address", "city", "district", "country", "description", "status"]}
    d["created_at"] = c.created_at.isoformat() if c.created_at else None
    d["approved_at"] = c.approved_at.isoformat() if c.approved_at else None
    admin = next((u for u in c.users if u.role == "admin"), None)
    d["admin"] = admin and {"id": admin.id, "full_name": admin.full_name, "email": admin.email, "phone": admin.phone,
                            "is_active": admin.is_active}
    d["user_count"] = len(c.users)
    return d


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    q = db.query(Clinic)
    return {"clinics": q.count(), "active": q.filter(Clinic.status == "active").count(),
            "pending": q.filter(Clinic.status == "pending").count(),
            "suspended": q.filter(Clinic.status == "suspended").count(),
            "class_a": q.filter(Clinic.clinic_class == "A").count(),
            "class_b": q.filter(Clinic.clinic_class == "B").count(),
            "users": db.query(User).filter(User.clinic_id.isnot(None)).count()}


@router.get("/clinics")
def list_clinics(db: Session = Depends(get_db)):
    return [_row(c) for c in db.query(Clinic).order_by(Clinic.id.desc()).all()]


@router.post("/clinics", status_code=201)
def create_clinic(body: ClinicIn, db: Session = Depends(get_db)):
    data = body.model_dump()
    admin_data = {k: data.pop(k) for k in ["admin_name", "admin_email", "admin_phone"]}
    for _ in range(5):  # the database also enforces unique codes; retry in the rare case of a clash
        clinic = Clinic(code=_code(db, body.clinic_class), status="pending", approval_token=new_link_token(), **data)
        db.add(clinic)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
    else:
        raise HTTPException(500, "Could not generate a unique clinic code. Please try again.")
    admin = User(clinic_id=clinic.id, full_name=admin_data["admin_name"], email=admin_data["admin_email"].lower(),
                 phone=admin_data["admin_phone"], role="admin", is_active=False,
                 activation_token=new_link_token(), token_expires=datetime.utcnow() + timedelta(days=settings.INVITE_DAYS))
    db.add(admin)
    db.commit()
    mails = [send_clinic_approval(db, clinic, admin), send_account_activation(db, admin, clinic)]
    return {**_row(clinic), "emails": mails}


def _get(db, cid) -> Clinic:
    c = db.get(Clinic, cid)
    if not c:
        raise HTTPException(404, "Clinic not found.")
    return c


@router.patch("/clinics/{cid}")
def update_clinic(cid: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    c = _get(db, cid)
    for k in EDITABLE:
        if k in payload:
            setattr(c, k, payload[k] or None if k not in ("name",) else (payload[k] or c.name))
    db.commit()
    return _row(c)


class StatusIn(BaseModel):
    status: Literal["active", "suspended"]


@router.post("/clinics/{cid}/status")
def set_status(cid: int, body: StatusIn, db: Session = Depends(get_db)):
    c = _get(db, cid)
    if not c.approved_at:
        raise HTTPException(400, "The clinic admin has not approved this clinic yet.")
    c.status = body.status
    db.commit()
    return _row(c)


@router.post("/clinics/{cid}/resend")
def resend(cid: int, db: Session = Depends(get_db)):
    c = _get(db, cid)
    admin = next((u for u in c.users if u.role == "admin"), None)
    mails = []
    if c.status == "pending" and not c.approved_at and admin:
        c.approval_token = new_link_token()
        db.commit()
        mails.append(send_clinic_approval(db, c, admin))
    if admin and not admin.password_hash:
        admin.activation_token = new_link_token()
        admin.token_expires = datetime.utcnow() + timedelta(days=settings.INVITE_DAYS)
        db.commit()
        mails.append(send_account_activation(db, admin, c))
    if not mails:
        raise HTTPException(400, "Nothing is waiting for approval.")
    return {"emails": mails}


@router.delete("/clinics/{cid}")
def delete_clinic(cid: int, db: Session = Depends(get_db)):
    c = _get(db, cid)
    for m in CLINIC_DATA:
        db.query(m).filter(m.clinic_id == cid).delete()
    db.query(User).filter(User.clinic_id == cid).delete()
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.get("/outbox")
def outbox(db: Session = Depends(get_db)):
    rows = db.query(EmailOutbox).order_by(EmailOutbox.id.desc()).limit(100).all()
    return [{"id": r.id, "to": r.to_email, "subject": r.subject, "body": r.body_text, "sent": r.sent,
             "error": r.error, "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/email-status")
def email_status():
    return {"configured": smtp_configured(), "host": settings.SMTP_HOST, "port": settings.SMTP_PORT,
            "security": settings.SMTP_SECURITY, "from": settings.SMTP_FROM, "frontend_url": settings.FRONTEND_URL}


class TestMail(BaseModel):
    to: EmailStr


@router.post("/email-test")
def email_test(body: TestMail, db: Session = Depends(get_db)):
    return deliver(db, body.to, "ClinicPro test email", "Test email", ["If you can read this, email delivery works."], "Open ClinicPro", settings.FRONTEND_URL)


@router.get("/subscriptions")
def subscriptions(db: Session = Depends(get_db)):
    """Read-only view of every clinic's subscription."""
    by = {}
    for p in db.query(SubscriptionPayment).order_by(SubscriptionPayment.id):
        by.setdefault(p.clinic_id, []).append(p)
    rows = []
    for c in db.query(Clinic).order_by(Clinic.id.desc()):
        ps = by.get(c.id, [])
        rows.append({"id": c.id, "code": c.code, "name": c.name, "clinic_class": c.clinic_class, "status": c.status, "subscription": sub_state(c),
                     "payments": len(ps), "total_paid": sum(p.amount or 0 for p in ps), "last_payment": iso(ps[-1].created_at) if ps else None,
                     "admin": next(({"full_name": u.full_name, "email": u.email} for u in c.users if u.role == "admin"), None)})
    live = [r for r in rows if r["subscription"]["state"] == "active"]
    return {"summary": {"active": len(live), "on_trial": sum(1 for r in live if r["subscription"]["trial"]),
                        "expired": sum(1 for r in rows if r["subscription"]["state"] == "expired"),
                        "revenue": sum(r["total_paid"] for r in rows), "payments": sum(r["payments"] for r in rows)}, "clinics": rows}


@router.get("/subscriptions/{cid}")
def subscription_history(cid: int, db: Session = Depends(get_db)):
    c = _get(db, cid)
    ps = db.query(SubscriptionPayment).filter(SubscriptionPayment.clinic_id == cid).order_by(SubscriptionPayment.id.desc()).all()
    return {"clinic": {"id": c.id, "code": c.code, "name": c.name, "clinic_class": c.clinic_class}, "subscription": sub_state(c),
            "payments": [{"id": p.id, "amount": p.amount, "method": p.method, "reference": p.reference, "paid_by": p.paid_by,
                          "period_start": iso(p.period_start), "period_end": iso(p.period_end), "created_at": iso(p.created_at)} for p in ps]}
