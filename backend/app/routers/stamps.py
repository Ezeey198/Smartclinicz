"""The clinic's digital stamp. The admin uploads one (made from a photo of the real stamp, cleaned up in the browser).
Each use puts the CURRENT date and the user's own name under the stamp, and is logged so a stamped document cannot be back-dated."""
import base64
import re
import struct
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only, clinic_member
from ..models import (Appointment, Expense, ImagingOrder, InventoryItem, Invoice, LabOrder, LeaveRequest, Patient, Payment, Prescription,
                      SalaryPayment, StampUse, Visit, Encounter, Sale)
from ..roles import ROLE_LABELS, module_level
from ..subscriptions import iso

# doc type -> (table, module that must be available, name for messages, roles that may stamp it; the clinic admin may stamp everything)
DOCS = {
    "invoice": (Invoice, "billing", "invoice", ("accountant", "receptionist", "pharmacist")),
    "receipt": (Payment, "billing", "receipt", ("accountant", "pharmacist")),
    "prescription": (Prescription, "pharmacy", "prescription", ("doctor", "pharmacist")),
    "consultation": (Visit, "visits", "consultation record", ("doctor", "nurse")),
    "lab_report": (LabOrder, "lab", "lab report", ("lab_technician", "doctor")),
    "imaging_report": (ImagingOrder, "imaging", "imaging report", ("radiologist", "doctor")),
    "appointment_slip": (Appointment, "appointments", "appointment slip", ("receptionist", "nurse", "doctor")),
    "goods_received": (InventoryItem, "inventory", "stock record", ("pharmacist",)),
    "leave_letter": (LeaveRequest, "hr", "leave letter", ()),
    "salary_slip": (SalaryPayment, "payroll", "salary slip", ("accountant",)),
    "patient_summary": (Patient, "patients", "patient summary", ("doctor", "nurse", "receptionist")),
    "case_file": (Encounter, "cases", "case file", ("doctor", "pharmacist")),
    "sale_receipt": (Sale, "sales", "sale receipt", ("pharmacy_seller",)),
    "expense_voucher": (Expense, "accounts", "expense voucher", ("accountant",)),
}
READY = {  # a stamp means "approved", so some documents must be finished first
    "lab_report": ("status", "completed", "A lab report can be stamped once the test is completed."),
    "imaging_report": ("status", "reported", "An imaging report can be stamped once it has been reported."),
    "case_file": ("stage", ["awaiting_payment", "completed"], "The case file can be stamped once the pharmacy has generated the bill."),
}

router = APIRouter(prefix="/stamps", tags=["stamps"])


def _png_ok(data_url: str):
    if not data_url.startswith("data:image/png;base64,"):
        raise HTTPException(422, "The stamp must be a PNG image.")
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except Exception:
        raise HTTPException(422, "The stamp image is damaged. Try again.")
    if len(raw) > 700_000:
        raise HTTPException(413, "The stamp image is too large. Use a smaller photo.")
    if raw[:8] != b"\x89PNG\r\n\x1a\n" or len(raw) < 33:
        raise HTTPException(422, "The stamp must be a PNG image.")
    w, h = struct.unpack(">II", raw[16:24])
    if not (60 <= w <= 1600 and 60 <= h <= 1600):
        raise HTTPException(422, "The stamp image has an unusual size. Crop closer to the stamp.")


@router.get("/clinic")
def clinic_stamp(user=Depends(clinic_member)):
    c = user.clinic
    return {"has_stamp": bool(c.stamp_image), "image": c.stamp_image, "ink": c.stamp_ink or "#1b3a8a", "updated_at": iso(c.stamp_updated)}


class StampIn(BaseModel):
    image: str
    ink: str | None = None


@router.put("/clinic")
def save_stamp(body: StampIn, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    _png_ok(body.image)
    c = user.clinic
    c.stamp_image, c.stamp_updated = body.image, datetime.utcnow()
    c.stamp_ink = body.ink if body.ink and re.fullmatch(r"#[0-9a-fA-F]{6}", body.ink) else "#1b3a8a"
    log(db, user, "stamp", "updated", f"{user.full_name} uploaded a new clinic stamp")
    db.commit()
    return {"ok": True}


@router.delete("/clinic")
def remove_stamp(user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    user.clinic.stamp_image, user.clinic.stamp_updated = None, None
    log(db, user, "stamp", "deleted", f"{user.full_name} removed the clinic stamp")
    db.commit()
    return {"ok": True}


class ApplyIn(BaseModel):
    doc_type: str
    doc_id: int
    doc_ref: str | None = None


def _use(u: StampUse):
    return {"id": u.id, "user_name": u.user_name, "role": u.role, "role_label": ROLE_LABELS.get(u.role, u.role), "doc_type": u.doc_type,
            "doc_id": u.doc_id, "doc_ref": u.doc_ref, "stamped_at": iso(u.stamped_at)}


@router.post("/apply")
def apply_stamp(body: ApplyIn, user=Depends(clinic_member), db: Session = Depends(get_db)):
    spec = DOCS.get(body.doc_type)
    if not spec:
        raise HTTPException(422, "This kind of document cannot be stamped.")
    model, module, noun, roles = spec
    c = user.clinic
    if not c.stamp_image:
        raise HTTPException(400, "The clinic stamp has not been uploaded yet. Ask the clinic admin to add it.")
    if user.role != "admin" and (user.role not in roles or module_level(c.clinic_class, user.role, module) is None):
        raise HTTPException(403, f"Your role cannot stamp a {noun}.")
    rec = db.query(model).filter(model.id == body.doc_id, model.clinic_id == user.clinic_id).first()
    if not rec:
        raise HTTPException(404, "Document not found.")
    if body.doc_type in READY:
        field, value, msg = READY[body.doc_type]
        if getattr(rec, field) not in (value if isinstance(value, list) else [value]):
            raise HTTPException(400, msg)
    ref = (body.doc_ref or noun)[:80]
    use = StampUse(clinic_id=user.clinic_id, user_id=user.id, user_name=user.full_name, role=user.role, doc_type=body.doc_type,
                   doc_id=body.doc_id, doc_ref=ref, stamped_at=datetime.utcnow())   # the date is always "now"; it cannot be chosen
    db.add(use)
    log(db, user, "stamp", "stamped", f"{user.full_name} stamped a {noun}: {ref}", {"document": ref, "type": body.doc_type})
    db.commit()
    return _use(use)


@router.get("/uses")
def uses(doc_type: str, doc_id: int, user=Depends(clinic_member), db: Session = Depends(get_db)):
    rows = db.query(StampUse).filter(StampUse.clinic_id == user.clinic_id, StampUse.doc_type == doc_type, StampUse.doc_id == doc_id).order_by(StampUse.id)
    return [_use(u) for u in rows]


@router.get("/log")
def stamp_log(user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    rows = db.query(StampUse).filter(StampUse.clinic_id == user.clinic_id).order_by(StampUse.id.desc()).limit(200)
    return [_use(u) for u in rows]
