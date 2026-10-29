"""One router factory for every clinical module. Each module adds its own hooks:
automatic charges, payment gates, wallet payments and activity logging for the clinic admin."""
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import module_guard
from ..models import (Appointment, Expense, ImagingOrder, InventoryItem, Invoice, LabOrder, LeaveRequest, Patient, Prescription,
                      SalaryPayment, ServicePrice, User, Visit)
from ..pricing import charger, pay_gate
from ..wallet import wallet_post


def ser(obj) -> dict:
    out = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.name)
        out[c.name] = v.isoformat() if isinstance(v, datetime) else v
    return out


def make_router(module, model, fields, required=(), author=None, number=None, hook=None, noun=None, after_create=None, gate=None):
    noun = noun or module
    r = APIRouter(prefix=f"/{module}", tags=[module])
    read, write = module_guard(module), module_guard(module, write=True)

    def clean(db, user, payload, partial=False):
        data = {}
        for k, t in fields.items():
            if k not in payload:
                continue
            v = payload[k]
            if v in ("", None):
                v = None
            elif t == "bool":
                v = str(v).strip().lower() in ("yes", "true", "1", "on")
            else:
                try:
                    v = float(v) if t == "float" else int(v) if t == "int" else str(v).strip()
                except ValueError:
                    raise HTTPException(422, f"{k.replace('_', ' ').capitalize()} must be a number.")
            data[k] = v
        for k in required:
            if (k in data or not partial) and data.get(k) in (None, ""):
                raise HTTPException(422, f"{k.replace('_', ' ').capitalize()} is required.")
        sid = data.get("staff_id")
        if sid and not db.query(User).filter(User.id == sid, User.clinic_id == user.clinic_id).first():
            raise HTTPException(422, "Choose a staff member from this clinic.")
        pid = data.get("patient_id")
        if pid and not db.query(Patient).filter(Patient.id == pid, Patient.clinic_id == user.clinic_id).first():
            raise HTTPException(422, "Choose a patient from this clinic.")
        return data

    def out(db, user, rows):
        ids = {x.patient_id for x in rows if getattr(x, "patient_id", None)}
        names = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == user.clinic_id, Patient.id.in_(ids))} if ids else {}
        sids = {x.staff_id for x in rows if getattr(x, "staff_id", None)}
        snames = {u.id: u.full_name for u in db.query(User).filter(User.clinic_id == user.clinic_id, User.id.in_(sids))} if sids else {}
        iids = {x.invoice_id for x in rows if getattr(x, "invoice_id", None)}
        invs = {i.id: i for i in db.query(Invoice).filter(Invoice.clinic_id == user.clinic_id, Invoice.id.in_(iids))} if iids else {}
        res = []
        for x in rows:
            d = ser(x)
            if "patient_id" in d:
                d["patient_name"] = names.get(d["patient_id"])
            if "staff_id" in d:
                d["staff_name"] = snames.get(d["staff_id"])
            if d.get("invoice_id") in invs:
                inv = invs[d["invoice_id"]]
                d["invoice_no"], d["payment_status"] = inv.invoice_no, inv.status
                d["balance"] = (inv.amount or 0) - (inv.paid or 0)
            res.append(d)
        return res

    def get_one(db, user, rid):
        o = db.query(model).filter(model.id == rid, model.clinic_id == user.clinic_id).first()
        if not o:
            raise HTTPException(404, "Record not found.")
        return o

    def who(db, user, o):
        if isinstance(o, Patient):
            return o.full_name
        pid = getattr(o, "patient_id", None)
        p = pid and db.query(Patient).filter(Patient.id == pid, Patient.clinic_id == user.clinic_id).first()
        return p.full_name if p else None

    def say(user, verb, o, pn):
        if isinstance(o, Patient):
            return f"{user.full_name} {verb} a patient: {pn}"
        return f"{user.full_name} {verb} a {noun}" + (f" for {pn}" if pn else "")

    @r.get("")
    def list_(patient_id: int | None = None, user=Depends(read), db: Session = Depends(get_db)):
        q = db.query(model).filter(model.clinic_id == user.clinic_id)
        if patient_id and hasattr(model, "patient_id"):
            q = q.filter(model.patient_id == patient_id)
        return out(db, user, q.order_by(model.id.desc()).limit(1000).all())

    @r.post("", status_code=201)
    def create(payload: dict = Body(...), user=Depends(write), db: Session = Depends(get_db)):
        data = {k: v for k, v in clean(db, user, payload).items() if not (v is None and k == "status")}
        o = model(clinic_id=user.clinic_id, **data)
        if author:
            setattr(o, author, user.full_name)
        if number:
            field, prefix = number
            top = db.query(func.max(model.id)).filter(model.clinic_id == user.clinic_id).scalar() or 0
            setattr(o, field, f"{prefix}-{top + 1:06d}")
        if hook:
            hook(o)
        db.add(o)
        db.flush()
        if after_create:
            after_create(db, user, o, data)
        pn = who(db, user, o)
        log(db, user, module, "created", say(user, "created", o, pn), {**data, **({"patient": pn} if pn and not isinstance(o, Patient) else {})})
        db.commit()
        return out(db, user, [o])[0]

    @r.patch("/{rid}")
    def update(rid: int, payload: dict = Body(...), user=Depends(write), db: Session = Depends(get_db)):
        o = get_one(db, user, rid)
        data = clean(db, user, payload, partial=True)
        if gate:
            gate(db, user, o, data)
        changes = {}
        for k, v in data.items():
            old = getattr(o, k)
            if old != v:
                changes[k] = {"from": old, "to": v}
            setattr(o, k, v)
        if hook:
            hook(o)
        if changes:
            pn = who(db, user, o)
            log(db, user, module, "updated", say(user, "updated", o, pn), {**({"patient": pn} if pn and not isinstance(o, Patient) else {}), **changes})
        db.commit()
        return out(db, user, [o])[0]

    @r.delete("/{rid}")
    def delete(rid: int, user=Depends(write), db: Session = Depends(get_db)):
        if user.role != "admin":
            raise HTTPException(403, "Only the clinic admin can delete records.")
        o = get_one(db, user, rid)
        log(db, user, module, "deleted", say(user, "deleted", o, who(db, user, o)), ser(o))
        db.delete(o)
        db.commit()
        return {"ok": True}

    return r


def _invoice(o):
    amt, paid = o.amount or 0, o.paid or 0
    o.status = "paid" if amt > 0 and paid >= amt else "partial" if paid > 0 else "unpaid"


def _pay_expense(db, user, o, data):
    if o.paid_from_wallet:
        wallet_post(db, user.clinic, user, "expense", -(o.amount or 0), method="wallet", description=o.description)


def _lock_expense(db, user, o, data):
    if o.paid_from_wallet and any(k in data and data[k] != getattr(o, k) for k in ("amount", "paid_from_wallet")):
        raise HTTPException(400, "An expense paid from the wallet cannot be changed. Record a new one if needed.")


def _pay_salary(db, user, o, data):
    staff = db.get(User, o.staff_id)
    o.paid_by = user.full_name
    wallet_post(db, user.clinic, user, "salary", -(o.amount or 0), method="wallet", description=f"Salary {o.month}: {staff.full_name}")


def _no_edit(db, user, o, data):
    raise HTTPException(400, "Salary payments cannot be edited. Record a correction as a new payment.")


_none = lambda o: ""

routers = [
    make_router("patients", Patient,
                {"full_name": "str", "gender": "str", "date_of_birth": "str", "phone": "str", "address": "str",
                 "next_of_kin": "str", "next_of_kin_phone": "str", "blood_group": "str", "allergies": "str"},
                required=["full_name", "gender"], number=("patient_no", "P"), noun="patient",
                after_create=charger("registration", _none, "Registration fee", patient_of=lambda o: o.id, link=False)),
    make_router("appointments", Appointment,
                {"patient_id": "int", "doctor_name": "str", "scheduled_at": "str", "reason": "str", "status": "str"},
                required=["patient_id", "scheduled_at"], noun="appointment",
                after_create=charger("consultation", _none, "Consultation fee"), gate=pay_gate({"checked_in"}, "check-in")),
    make_router("visits", Visit,
                {"patient_id": "int", "temperature": "str", "blood_pressure": "str", "pulse": "str", "weight": "str",
                 "complaints": "str", "diagnosis": "str", "treatment_notes": "str"},
                required=["patient_id"], author="recorded_by", noun="consultation record"),
    make_router("lab", LabOrder,
                {"patient_id": "int", "test_name": "str", "notes": "str", "result": "str", "status": "str"},
                required=["patient_id", "test_name"], author="requested_by", noun="lab request",
                after_create=charger("lab", lambda o: o.test_name, "Lab test"), gate=pay_gate({"in_progress", "completed"}, "test")),
    make_router("pharmacy", Prescription,
                {"patient_id": "int", "drug": "str", "dosage": "str", "duration": "str", "status": "str"},
                required=["patient_id", "drug"], author="prescribed_by", noun="prescription",
                after_create=charger("pharmacy", lambda o: o.drug, "Medication"), gate=pay_gate({"dispensed"}, "dispensing")),
    make_router("billing", Invoice,
                {"patient_id": "int", "description": "str", "amount": "float", "paid": "float"},
                required=["patient_id", "description", "amount"], author="created_by", number=("invoice_no", "INV"), hook=_invoice, noun="invoice"),
    make_router("inventory", InventoryItem,
                {"name": "str", "category": "str", "quantity": "float", "unit": "str", "reorder_level": "float",
                 "expiry_date": "str", "supplier": "str"}, required=["name", "quantity"], noun="stock item"),
    make_router("imaging", ImagingOrder,
                {"patient_id": "int", "exam_type": "str", "body_part": "str", "clinical_info": "str", "findings": "str", "status": "str"},
                required=["patient_id", "exam_type"], author="requested_by", noun="imaging request",
                after_create=charger("imaging", lambda o: o.exam_type, "Imaging"), gate=pay_gate({"in_progress", "reported"}, "examination")),
    make_router("accounts", Expense,
                {"description": "str", "category": "str", "amount": "float", "expense_date": "str", "paid_from_wallet": "bool"},
                required=["description", "amount"], author="recorded_by", noun="expense", after_create=_pay_expense, gate=_lock_expense),
    make_router("hr", LeaveRequest,
                {"staff_id": "int", "leave_type": "str", "start_date": "str", "end_date": "str", "reason": "str", "status": "str"},
                required=["staff_id", "start_date", "end_date"], noun="leave request"),
    make_router("prices", ServicePrice, {"category": "str", "name": "str", "price": "float"},
                required=["category", "price"], noun="price"),
    make_router("payroll", SalaryPayment, {"staff_id": "int", "month": "str", "amount": "float", "note": "str"},
                required=["staff_id", "month", "amount"], noun="salary payment", after_create=_pay_salary, gate=_no_edit),
]
