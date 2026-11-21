"""Helpers for the patient journey: who is told at each step (staff and patient, page + SMS), the invitation to the patient's own page,
and the finished case file the patient can save. Nothing here prints a staff name on anything the patient sees."""
import json
from datetime import datetime, timedelta
from .config import settings
from .emailer import deliver
from .models import CaseCharge, CaseEvent, Clinic, Encounter, Invoice, LabOrder, Patient, Payment, Prescription, StampUse, User
from .notify import notify, notify_roles, sms
from .security import new_link_token

# What the patient reads for each step of their journey. No staff names, only what is happening to the patient.
STEP_TEXT = {
    "registered": "Your record was created and you were assigned to a doctor", "opened": "Your consultation was started",
    "doctor_confirmed": "The doctor called you in for the consultation", "consultation_saved": "Consultation notes recorded",
    "forwarded_to_lab": "Sent for laboratory tests", "forwarded_to_radiology": "Sent for imaging", "lab_started": "Test in progress",
    "lab_completed": "A result was released", "returned_to_doctor": "Results sent back to the doctor",
    "forwarded_to_pharmacy": "Prescription sent to the pharmacy", "dispensed": "Medicines dispensed", "prescription_cancelled": "A medicine was not supplied",
    "charge_added": "An extra item was added to your bill", "billed": "Your bill was prepared", "payment": "A payment was received",
    "closed": "All your files are complete", "nurse_assigned": "A nurse and a bed were assigned to you", "patient_called": "The pharmacy called you", "rx_queried": "The pharmacy asked your doctor a question about your prescription", "rx_answered": "Your doctor answered the pharmacy",
    "document_ready": "Your final document is ready",
}


def has_role(db, clinic_id, role) -> bool:
    return any(u.role == role for u in db.query(User).filter(User.clinic_id == clinic_id, User.is_active.is_(True)))


def tell_patient(db, enc, title, body=""):
    p = db.get(Patient, enc.patient_id)
    if p:
        notify(db, title, body, patient=p, link="/patient", kind="journey")


def tell_doctor(db, enc, title, body="", link="/app/desk"):
    d = enc.doctor_id and db.get(User, enc.doctor_id)
    if d:
        notify(db, title, body, users=[d], link=link, kind="journey", clinic_id=enc.clinic_id)


def tell_roles(db, enc, roles, title, body="", link="/app/cases"):
    notify_roles(db, enc.clinic_id, roles, title, body, link=link, kind="journey")


def system_event(db, enc, kind, details=None):
    db.add(CaseEvent(clinic_id=enc.clinic_id, encounter_id=enc.id, user_id=None, user_name="System", role="system", kind=kind, details=details))


def lab_returned(db, enc):
    """All lab or imaging results are in: the doctor and the patient are told."""
    tell_doctor(db, enc, "Results are ready", f"Case {enc.case_no}: all results are back. Review them and continue.")
    tell_patient(db, enc, "Your result is released", "The laboratory result has been sent to your doctor.")


def invite_patient(db, patient, clinic):
    """Emails (and texts) the patient the link to accept their own page and choose a password."""
    if not patient.email:
        return None
    patient.portal_token = new_link_token()
    patient.portal_token_expires = datetime.utcnow() + timedelta(days=settings.INVITE_DAYS)
    link = f"{settings.FRONTEND_URL}/patient/activate?token={patient.portal_token}"
    sms(db, patient.phone, f"{clinic.name}: open this link to follow your visit and get your documents: {link}", clinic.id)
    db.commit()
    return deliver(db, patient.email, f"Your patient page at {clinic.name}", "Your patient page",
                   [f"Hello {patient.full_name},", f"<b>{clinic.name}</b> has created a patient page for you. There you follow each step of your visit, "
                    "receive a message for every new step, and save your final document.", "Accept the page and choose a password to begin."],
                   "Accept and set password", link)


def snapshot(db, enc) -> dict:
    """The finished case file exactly as the patient receives it. It carries no staff name."""
    c, p = db.get(Clinic, enc.clinic_id), db.get(Patient, enc.patient_id)
    charges = db.query(CaseCharge).filter(CaseCharge.encounter_id == enc.id).order_by(CaseCharge.id).all()
    inv = db.get(Invoice, enc.invoice_id) if enc.invoice_id else None
    pays = db.query(Payment).filter(Payment.invoice_id == inv.id).order_by(Payment.id).all() if inv else []
    total = sum(x.amount or 0 for x in charges)
    st = db.query(StampUse).filter(StampUse.clinic_id == enc.clinic_id, StampUse.doc_type == "case_file", StampUse.doc_id == enc.id).order_by(StampUse.id.desc()).first()
    return {
        "clinic": {"name": c.name, "address": c.address, "city": c.city, "phone": c.phone},
        "case_no": enc.case_no, "visit_no": enc.visit_no, "opened_at": enc.created_at.isoformat(), "closed_at": enc.closed_at.isoformat() if enc.closed_at else None,
        "patient": {"full_name": p.full_name, "patient_no": p.patient_no, "gender": p.gender, "date_of_birth": p.date_of_birth, "phone": p.phone,
                    "address": p.address, "blood_group": p.blood_group, "allergies": p.allergies},
        "consultation": {k: getattr(enc, k) for k in ("complaints", "diagnosis", "treatment_notes", "temperature", "blood_pressure", "pulse", "weight")},
        "labs": [{"test": x.test_name, "result": x.result, "department": x.department or "lab"} for x in db.query(LabOrder).filter(LabOrder.encounter_id == enc.id).order_by(LabOrder.id)],
        "prescriptions": [{"drug": x.drug, "dosage": x.dosage, "duration": x.duration, "quantity": x.quantity, "status": x.status}
                          for x in db.query(Prescription).filter(Prescription.encounter_id == enc.id).order_by(Prescription.id)],
        "bill": {"lines": [{"description": x.description, "quantity": x.quantity, "unit_price": x.unit_price, "amount": x.amount} for x in charges],
                 "total": total, "paid": (inv.paid if inv else 0) or 0, "balance": total - ((inv.paid if inv else 0) or 0)},
        "payments": [{"receipt_no": f"RCT-{x.id:06d}", "method": x.method, "amount": x.amount, "at": x.created_at.isoformat()} for x in pays],
        "workflow": [{"at": e.created_at.isoformat(), "step": STEP_TEXT.get(e.kind, e.kind.replace("_", " ").capitalize())}
                     for e in db.query(CaseEvent).filter(CaseEvent.encounter_id == enc.id).order_by(CaseEvent.id) if e.kind in STEP_TEXT],
        "stamped_at": st.stamped_at.isoformat() if st else None,
    }


def try_finalize(db, enc) -> bool:
    """Once the bill is paid AND the case file is stamped, the finished document is saved for the patient's page and the patient is told."""
    if enc.final_doc or enc.stage != "completed":
        return False
    if not db.query(StampUse.id).filter(StampUse.clinic_id == enc.clinic_id, StampUse.doc_type == "case_file", StampUse.doc_id == enc.id).first():
        return False
    enc.final_doc = json.dumps(snapshot(db, enc), default=str)
    enc.doc_ready_at = datetime.utcnow()
    system_event(db, enc, "document_ready", "Final document stamped and ready for the patient")
    tell_patient(db, enc, "Your final document is ready", "All your files are complete, paid and stamped. Open your patient page to save the PDF.")
    return True
