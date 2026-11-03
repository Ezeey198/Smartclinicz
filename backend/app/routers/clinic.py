from datetime import datetime, timedelta
from typing import Literal
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from ..activity import log
from ..config import settings
from ..database import get_db
from ..deps import clinic_admin_only, clinic_member
from ..emailer import send_account_activation
from sqlalchemy import func
from ..roles import MONEY_ROLES
from ..models import (Activity, Appointment, Encounter, Product, Sale, SaleLine, StockBatch, ImagingOrder, InventoryItem, Invoice, LabOrder, LeaveRequest, Expense, Patient, Payment,
                      Prescription, User, Visit)
from ..roles import CLASS_ROLES, ROLE_LABELS, desc_for, label_for, module_level
from ..security import new_link_token

router = APIRouter(prefix="/clinic", tags=["clinic"])

PROFILE_FIELDS = ["name", "registration_number", "license_number", "email", "phone", "website",
                  "address", "city", "district", "country", "description"]


def _clinic(c):
    d = {k: getattr(c, k) for k in ["id", "code", "clinic_class", "status"] + PROFILE_FIELDS}
    d["approved_at"] = c.approved_at.isoformat() if c.approved_at else None
    return d


@router.get("/profile")
def profile(user: User = Depends(clinic_member)):
    return _clinic(user.clinic)


@router.patch("/profile")
def update_profile(payload: dict = Body(...), user: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    c = user.clinic
    for k in PROFILE_FIELDS:
        if k in payload and (k != "name" or payload[k]):
            setattr(c, k, payload[k] or None)
    log(db, user, "settings", "updated", f"{user.full_name} updated the clinic profile", {k: payload[k] for k in PROFILE_FIELDS if k in payload})
    db.commit()
    return _clinic(c)


@router.get("/roles")
def roles(user: User = Depends(clinic_member)):
    cls = user.clinic.clinic_class
    return [{"value": r, "label": label_for(r, cls), "description": desc_for(r, cls)} for r in CLASS_ROLES[cls]]


@router.get("/staff")
def staff(role: str | None = None, user: User = Depends(clinic_member), db: Session = Depends(get_db)):
    q = db.query(User).filter(User.clinic_id == user.clinic_id, User.is_active.is_(True))
    if role:
        q = q.filter(User.role == role)
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in q.order_by(User.full_name)]


def _urow(u: User):
    state = "active" if u.is_active else ("pending" if not u.password_hash else "inactive")
    return {"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "role": u.role,
            "role_label": label_for(u.role, u.clinic.clinic_class), "state": state,
            "created_at": u.created_at.isoformat() if u.created_at else None}


@router.get("/users")
def list_users(user: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    return [_urow(u) for u in db.query(User).filter(User.clinic_id == user.clinic_id).order_by(User.id)]


class UserIn(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    phone: str | None = None
    role: str


def _check_role(clinic, role):
    if role not in CLASS_ROLES[clinic.clinic_class]:
        raise HTTPException(400, f"{ROLE_LABELS.get(role, role)} is not available for Class {clinic.clinic_class} clinics.")


def _own(db, admin, uid) -> User:
    u = db.query(User).filter(User.id == uid, User.clinic_id == admin.clinic_id).first()
    if not u:
        raise HTTPException(404, "User not found.")
    return u


@router.post("/users", status_code=201)
def create_user(body: UserIn, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    _check_role(admin.clinic, body.role)
    email = body.email.lower()
    if db.query(User).filter(User.clinic_id == admin.clinic_id, User.email == email).first():
        raise HTTPException(400, "Someone at this clinic already uses that email.")
    u = User(clinic_id=admin.clinic_id, full_name=body.full_name, email=email, phone=body.phone, role=body.role,
             is_active=False, activation_token=new_link_token(),
             token_expires=datetime.utcnow() + timedelta(days=settings.INVITE_DAYS))
    db.add(u)
    log(db, admin, "staff", "created", f"{admin.full_name} added {u.full_name} as {label_for(body.role, admin.clinic.clinic_class)}", {"email": email, "role": body.role})
    db.commit()
    mail = send_account_activation(db, u, admin.clinic)
    return {**_urow(u), "email": mail}


@router.patch("/users/{uid}")
def update_user(uid: int, payload: dict = Body(...), admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    u = _own(db, admin, uid)
    if "role" in payload and payload["role"] != u.role:
        if u.id == admin.id:
            raise HTTPException(400, "You cannot change your own role.")
        _check_role(admin.clinic, payload["role"])
        u.role = payload["role"]
    if payload.get("full_name"):
        u.full_name = payload["full_name"]
    if "phone" in payload:
        u.phone = payload["phone"] or None
    log(db, admin, "staff", "updated", f"{admin.full_name} edited the account of {u.full_name}", {k: payload[k] for k in ("full_name", "phone", "role") if k in payload})
    db.commit()
    return _urow(u)


@router.post("/users/{uid}/toggle")
def toggle_user(uid: int, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    u = _own(db, admin, uid)
    if u.id == admin.id:
        raise HTTPException(400, "You cannot deactivate your own account.")
    if not u.is_active and not u.password_hash:
        raise HTTPException(400, "This person has not approved their account by email yet. Resend the activation link instead.")
    u.is_active = not u.is_active
    log(db, admin, "staff", "activated" if u.is_active else "deactivated", f"{admin.full_name} {'reactivated' if u.is_active else 'deactivated'} {u.full_name}", {"role": u.role})
    db.commit()
    return _urow(u)


@router.post("/users/{uid}/resend")
def resend_user(uid: int, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    u = _own(db, admin, uid)
    u.activation_token = new_link_token()
    u.token_expires = datetime.utcnow() + timedelta(days=settings.INVITE_DAYS)
    db.commit()
    return {"ok": True, "email": send_account_activation(db, u, admin.clinic)}


@router.delete("/users/{uid}")
def delete_user(uid: int, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    u = _own(db, admin, uid)
    if u.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account.")
    db.query(LeaveRequest).filter(LeaveRequest.staff_id == uid).delete()
    log(db, admin, "staff", "deleted", f"{admin.full_name} deleted the account of {u.full_name}", {"role": u.role, "email": u.email})
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/dashboard")
def dashboard(user: User = Depends(clinic_member), db: Session = Depends(get_db)):
    cid, cls = user.clinic_id, user.clinic.clinic_class
    can = lambda m: module_level(cls, user.role, m)
    now = datetime.utcnow()
    today, start = now.strftime("%Y-%m-%d"), now.replace(hour=0, minute=0, second=0, microsecond=0)
    count = lambda model, *f: db.query(model).filter(model.clinic_id == cid, *f).count()
    total = lambda col, model, *f: float(db.query(func.coalesce(func.sum(col), 0)).filter(model.clinic_id == cid, *f).scalar() or 0)
    out = {}
    if cls == "P":
        return _pharmacy_dashboard(db, user, start)
    if can("patients"):
        out["patients"] = count(Patient)
    if can("appointments"):
        rows = db.query(Appointment).filter(Appointment.clinic_id == cid, Appointment.scheduled_at.like(f"{today}%")).order_by(Appointment.scheduled_at).all()
        names = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == cid)}
        fmt = lambda xs: [{"id": a.id, "time": (a.scheduled_at or "")[11:16], "patient_name": names.get(a.patient_id),
                           "doctor_name": a.doctor_name, "reason": a.reason, "status": a.status} for a in xs]
        out["appointments_today"] = len(rows)
        out["checked_in"] = sum(1 for a in rows if a.status == "checked_in")
        out["today_list"] = fmt(rows[:8])
        if user.role == "doctor":
            mine = [a for a in rows if a.doctor_name == user.full_name]
            out["my_appointments"], out["my_list"] = len(mine), fmt(mine[:8])
    if can("visits"):
        out["visits_today"] = count(Visit, Visit.created_at >= start)
    if can("lab"):
        out["lab_open"] = count(LabOrder, LabOrder.status != "completed")
        out["lab_completed"] = count(LabOrder, LabOrder.status == "completed")
    if can("pharmacy"):
        out["rx_pending"] = count(Prescription, Prescription.status == "pending")
        out["rx_dispensed"] = count(Prescription, Prescription.status == "dispensed")
    if can("inventory"):
        low = db.query(InventoryItem).filter(InventoryItem.clinic_id == cid, InventoryItem.reorder_level.isnot(None),
                                             InventoryItem.quantity <= InventoryItem.reorder_level)
        out["stock_items"] = count(InventoryItem)
        out["low_stock"] = low.count()
        out["low_list"] = [{"id": i.id, "name": i.name, "quantity": i.quantity, "unit": i.unit, "reorder_level": i.reorder_level} for i in low.limit(8)]
    if can("imaging"):
        out["imaging_open"] = count(ImagingOrder, ImagingOrder.status != "reported")
        out["imaging_reported"] = count(ImagingOrder, ImagingOrder.status == "reported")
    if can("billing") or can("accounts"):
        out["invoices_unpaid"] = count(Invoice, Invoice.status != "paid")
    if user.role in ("admin", "cashier", "accountant") and can("billing"):
        out["collected"] = total(Invoice.paid, Invoice)
        out["outstanding"] = total(Invoice.amount, Invoice) - out["collected"]
    if user.role in ("admin", "cashier", "accountant", "pharmacist") and can("billing"):
        out["payments_today"] = total(Payment.amount, Payment, Payment.created_at >= start)
    if user.role in MONEY_ROLES:
        out["wallet_balance"] = user.clinic.wallet_balance or 0
    if user.role == "admin":
        out["alerts"] = count(Activity, Activity.id > (user.last_seen_activity_id or 0), Activity.user_id != user.id)
    if can("accounts") and user.role in ("admin", "accountant"):
        out["expenses_total"] = total(Expense.amount, Expense)
    if can("cases"):
        stage = lambda s: count(Encounter, Encounter.stage == s)
        out["cases_with_doctor"], out["cases_back"], out["cases_lab"] = stage("with_doctor"), stage("back_to_doctor"), stage("at_lab")
        out["cases_pharmacy"], out["cases_unpaid"] = stage("at_pharmacy"), stage("awaiting_payment")
        out["cases_done_today"] = count(Encounter, Encounter.stage == "completed", Encounter.closed_at >= start)
    if can("hr"):
        out["leave_pending"] = count(LeaveRequest, LeaveRequest.status == "pending")
        out["on_leave"] = count(LeaveRequest, LeaveRequest.status == "approved", LeaveRequest.start_date <= today, LeaveRequest.end_date >= today)
    if user.role in ("admin", "hr_manager"):
        out["staff"] = count(User)
        out["staff_pending"] = count(User, User.is_active.is_(False))
    return out


def _pharmacy_dashboard(db, user, start):
    cid, admin = user.clinic_id, user.role == "admin"
    today = start.strftime("%Y-%m-%d")
    soon = (start + timedelta(days=90)).strftime("%Y-%m-%d")
    q = db.query(Sale).filter(Sale.clinic_id == cid, Sale.status == "completed", Sale.created_at >= start)
    if not admin:
        q = q.filter(Sale.sold_by_id == user.id)
    sales = q.all()
    out = {"sales_today": len(sales), "revenue_today": sum(s.total or 0 for s in sales)}
    if not admin:
        ids = [s.id for s in sales] or [0]
        out["items_today"] = float(db.query(func.coalesce(func.sum(SaleLine.quantity), 0)).filter(SaleLine.sale_id.in_(ids)).scalar() or 0)
    else:
        month = db.query(Sale).filter(Sale.clinic_id == cid, Sale.status == "completed", Sale.created_at >= start.replace(day=1)).all()
        out["revenue_month"] = sum(s.total or 0 for s in month)
        out["staff"] = db.query(User).filter(User.clinic_id == cid).count()
        out["wallet_balance"] = user.clinic.wallet_balance or 0
        out["alerts"] = db.query(Activity).filter(Activity.clinic_id == cid, Activity.id > (user.last_seen_activity_id or 0), Activity.user_id != user.id).count()
    products = db.query(Product).filter(Product.clinic_id == cid).all()
    totals, expired, expiring, value = {}, 0, 0, 0.0
    for b in db.query(StockBatch).filter(StockBatch.clinic_id == cid, StockBatch.quantity > 0):
        value += (b.quantity or 0) * (b.cost_price or 0)
        if b.expiry_date and b.expiry_date < today:
            expired += 1
        else:
            totals[b.product_id] = totals.get(b.product_id, 0) + b.quantity
            if b.expiry_date and b.expiry_date <= soon:
                expiring += 1
    low = [p for p in products if p.reorder_level is not None and totals.get(p.id, 0) <= p.reorder_level]
    out.update({"products": len(products), "low_stock": len(low), "expiring_soon": expiring, "expired_batches": expired,
                "low_list": [{"id": p.id, "name": p.name, "quantity": totals.get(p.id, 0), "unit": p.unit, "reorder_level": p.reorder_level} for p in low[:8]]})
    if admin:
        out["stock_value"] = value
    return out
