"""Class B patient journey ("case"): the doctor receives the patient and consults, sends them to the lab and/or the pharmacy,
the lab returns results to the doctor, the pharmacist dispenses and sells, and ONE bill (consultation + lab + drugs) is paid.
Every step is recorded with who did it and when, so the clinic admin can track it."""
from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import flow
from .. import stockkeeping as sk
from ..activity import log
from ..notify import flush_sms
from ..database import get_db
from ..deps import module_guard
from ..models import CaseCharge, CaseEvent, Encounter, InventoryItem, Invoice, LabOrder, Patient, Payment, Prescription, User
from ..pricing import price_for, raise_invoice
from ..roles import ROLE_LABELS
from .records import ser

router = APIRouter(prefix="/cases", tags=["cases"])
read, write = module_guard("cases"), module_guard("cases", write=True)
KINDS = ("registration", "consultation", "lab", "drug", "other")
STAGES_OPEN = ("awaiting_doctor", "with_doctor", "at_lab", "back_to_doctor", "at_pharmacy", "awaiting_payment")


def need(user, *roles):
    if user.role != "admin" and user.role not in roles:
        raise HTTPException(403, "Your role cannot do this step.")


def _need_fee(enc):
    if enc.consult_fee is None:
        raise HTTPException(400, "Enter the consultation fee first (it can be 0) before sending the patient on.")


def _get(db, user, cid) -> Encounter:
    e = db.query(Encounter).filter(Encounter.id == cid, Encounter.clinic_id == user.clinic_id).first()
    if not e:
        raise HTTPException(404, "Case not found.")
    return e


def _stage(enc, *stages):
    if enc.stage not in stages:
        raise HTTPException(400, "This step is not available at the case's current stage.")


def _event(db, enc, user, kind, details=None):
    db.add(CaseEvent(clinic_id=enc.clinic_id, encounter_id=enc.id, user_id=user.id, user_name=user.full_name, role=user.role, kind=kind, details=details))


def _charge(db, enc, user, kind, desc, qty, unit, ref=None):
    c = CaseCharge(clinic_id=enc.clinic_id, encounter_id=enc.id, kind=kind, description=desc, quantity=qty, unit_price=unit,
                   amount=round(qty * unit, 2), ref_id=ref, added_by=user.full_name)
    db.add(c)
    return c


def _sync_lab(db, enc):
    """If every lab test of a case at the lab is completed, hand the case back to the doctor (self-healing)."""
    if enc.stage != "at_lab":
        return False
    labs = db.query(LabOrder).filter(LabOrder.encounter_id == enc.id).all()
    if labs and all(x.status == "completed" for x in labs):
        enc.stage = "back_to_doctor"
        db.add(CaseEvent(clinic_id=enc.clinic_id, encounter_id=enc.id, user_id=None, user_name="System", role="system", kind="returned_to_doctor",
                         details="All lab results are ready for the doctor"))
        flow.lab_returned(db, enc)
        return True
    return False


def _totals(charges, inv):
    t = {k: 0.0 for k in KINDS}
    for c in charges:
        t[c.kind if c.kind in t else "other"] += c.amount or 0
    total = sum(t.values())
    paid = (inv.paid if inv else 0) or 0
    return {**t, "total": total, "paid": paid, "balance": total - paid}


def _detail(db, enc):
    inv = db.get(Invoice, enc.invoice_id) if enc.invoice_id else None
    charges = db.query(CaseCharge).filter(CaseCharge.encounter_id == enc.id).order_by(CaseCharge.id).all()
    pays = db.query(Payment).filter(Payment.invoice_id == inv.id).order_by(Payment.id).all() if inv else []
    return {
        "case": {k: v for k, v in ser(enc).items() if k != "final_doc"}, "patient": ser(db.get(Patient, enc.patient_id)),
        "charges": [ser(c) for c in charges],
        "labs": [ser(x) for x in db.query(LabOrder).filter(LabOrder.encounter_id == enc.id).order_by(LabOrder.id)],
        "prescriptions": [ser(x) for x in db.query(Prescription).filter(Prescription.encounter_id == enc.id).order_by(Prescription.id)],
        "events": [{**ser(e), "role_label": ROLE_LABELS.get(e.role, e.role)} for e in db.query(CaseEvent).filter(CaseEvent.encounter_id == enc.id).order_by(CaseEvent.id)],
        "invoice": ser(inv) | {"patient_name": db.get(Patient, enc.patient_id).full_name} if inv else None,
        "payments": [{**ser(p), "receipt_no": f"RCT-{p.id:06d}"} for p in pays],
        "totals": _totals(charges, inv),
    }


@router.get("")
def list_cases(user=Depends(read), db: Session = Depends(get_db)):
    encs = db.query(Encounter).filter(Encounter.clinic_id == user.clinic_id).order_by(Encounter.id.desc()).limit(500).all()
    if not encs:
        return []
    if any(_sync_lab(db, e) for e in encs):
        db.commit()
    ids = [e.id for e in encs]
    names = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == user.clinic_id)}
    sums = dict(db.query(CaseCharge.encounter_id, func.coalesce(func.sum(CaseCharge.amount), 0)).filter(CaseCharge.encounter_id.in_(ids)).group_by(CaseCharge.encounter_id).all())
    invs = {i.id: i for i in db.query(Invoice).filter(Invoice.clinic_id == user.clinic_id, Invoice.id.in_([e.invoice_id for e in encs if e.invoice_id] or [0]))}
    last = {}
    for ev in db.query(CaseEvent).filter(CaseEvent.encounter_id.in_(ids)).order_by(CaseEvent.id.desc()):
        last.setdefault(ev.encounter_id, ev)
    out = []
    for e in encs:
        inv, ev = invs.get(e.invoice_id), last.get(e.id)
        total = float(sums.get(e.id, 0))
        out.append({"id": e.id, "case_no": e.case_no, "patient_id": e.patient_id, "patient_name": names.get(e.patient_id), "stage": e.stage,
                    "doctor_name": e.doctor_name, "visit_no": e.visit_no, "nurse_id": e.nurse_id, "nurse_name": e.nurse_name, "room": e.room, "bed": e.bed, "opened_at": e.created_at.isoformat(), "closed_at": e.closed_at.isoformat() if e.closed_at else None,
                    "total": total, "paid": (inv.paid if inv else 0) or 0, "invoice_status": inv.status if inv else None,
                    "last_event": ev and {"kind": ev.kind, "user_name": ev.user_name, "role_label": ROLE_LABELS.get(ev.role, ev.role), "created_at": ev.created_at.isoformat()}})
    return out


@router.get("/doctors")
def doctors(user=Depends(read), db: Session = Depends(get_db)):
    """The doctors a patient can be assigned to, with how many patients each has waiting, so the receptionist can pick an available one."""
    out = []
    for d in db.query(User).filter(User.clinic_id == user.clinic_id, User.is_active.is_(True)).order_by(User.full_name):
        if d.role != "doctor":
            continue
        busy = db.query(Encounter).filter(Encounter.clinic_id == user.clinic_id, Encounter.doctor_id == d.id, Encounter.stage.in_(STAGES_OPEN)).count()
        out.append({"id": d.id, "full_name": d.full_name, "open_cases": busy})
    return sorted(out, key=lambda x: x["open_cases"])


@router.get("/nurses")
def nurses(user=Depends(read), db: Session = Depends(get_db)):
    return [{"id": n.id, "full_name": n.full_name} for n in db.query(User).filter(User.clinic_id == user.clinic_id, User.is_active.is_(True)).order_by(User.full_name) if n.role == "nurse"]


@router.get("/{cid}")
def get_case(cid: int, user=Depends(read), db: Session = Depends(get_db)):
    enc = _get(db, user, cid)
    if _sync_lab(db, enc):
        db.commit()
    return _detail(db, enc)


class OpenIn(BaseModel):
    patient_id: int | None = None
    full_name: str | None = None
    gender: str | None = None
    date_of_birth: str | None = None
    phone: str | None = None
    address: str | None = None
    next_of_kin: str | None = None
    next_of_kin_phone: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    email: str | None = None              # the patient's own email, or an attendant's, for the patient's page
    doctor_id: int | None = None          # receptionist: the doctor the patient is assigned to


def _patient_for(db, user, body):
    """An existing patient, or a new one registered now. Returns (patient, is_new). A new email is saved and the patient is invited to their page."""
    cid = user.clinic_id
    if body.patient_id:
        patient = db.query(Patient).filter(Patient.id == body.patient_id, Patient.clinic_id == cid).first()
        if not patient:
            raise HTTPException(404, "Patient not found.")
        new = False
        if (body.email or "").strip() and (body.email or "").strip().lower() != (patient.email or "").lower():
            patient.email = body.email.strip().lower()
            patient.portal_active = False
    else:
        if not (body.full_name or "").strip() or not body.gender:
            raise HTTPException(422, "Enter the patient's name and gender, or choose an existing patient.")
        top = db.query(func.max(Patient.id)).filter(Patient.clinic_id == cid).scalar() or 0
        data = {k: (v or "").strip() or None for k, v in body.model_dump(exclude={"patient_id", "doctor_id"}).items()}
        if data.get("email"):
            data["email"] = data["email"].lower()
        patient = Patient(clinic_id=cid, patient_no=f"P-{top + 1:06d}", **data)
        db.add(patient)
        db.flush()
        new = True
    open_ = db.query(Encounter).filter(Encounter.clinic_id == cid, Encounter.patient_id == patient.id, Encounter.stage != "completed").first()
    if open_:
        raise HTTPException(400, f"{patient.full_name} already has an open case ({open_.case_no}).")
    return patient, new


def _new_encounter(db, user, patient, new, stage, doctor):
    cid = user.clinic_id
    top = db.query(func.max(Encounter.id)).filter(Encounter.clinic_id == cid).scalar() or 0
    visits = db.query(func.count(Encounter.id)).filter(Encounter.clinic_id == cid, Encounter.patient_id == patient.id).scalar() or 0
    patient.portal_session_until = None          # a new visit opens the patient's page again
    enc = Encounter(clinic_id=cid, patient_id=patient.id, case_no=f"CS-{top + 1:06d}", stage=stage, visit_no=visits + 1,
                    doctor_id=doctor.id if doctor else None, doctor_name=doctor.full_name if doctor else None)
    db.add(enc)
    db.flush()
    if new and (fee := price_for(db, cid, "registration", "")):
        _charge(db, enc, user, "registration", "Patient registration fee", 1, fee)
    return enc


def _invite_if_needed(db, user, patient):
    if patient.email and not patient.portal_active:
        flow.invite_patient(db, patient, user.clinic)


@router.post("/register", status_code=201)
def register_patient(body: OpenIn, user=Depends(write), db: Session = Depends(get_db)):
    """The receptionist receives the patient: records them (or finds the existing record) and assigns an available doctor.
    The doctor then confirms and consults; the doctor never has to register the patient."""
    need(user, "receptionist")
    doctor = body.doctor_id and db.query(User).filter(User.id == body.doctor_id, User.clinic_id == user.clinic_id, User.is_active.is_(True)).first()
    if not doctor or doctor.role != "doctor":
        raise HTTPException(422, "Choose the doctor this patient is assigned to.")
    patient, new = _patient_for(db, user, body)
    enc = _new_encounter(db, user, patient, new, "awaiting_doctor", doctor)
    _event(db, enc, user, "registered", (f"New patient registered. " if new else f"Returning patient, visit {enc.visit_no}. ") + "Assigned to a doctor")
    log(db, user, "cases", "created", f"{user.full_name} received {patient.full_name} (case {enc.case_no}, visit {enc.visit_no}) and assigned a doctor", {"case": enc.case_no, "new_patient": new})
    flow.tell_doctor(db, enc, "New patient assigned to you", f"{patient.full_name} (visit {enc.visit_no}) is waiting. Confirm and start the consultation.")
    flow.tell_patient(db, enc, "You are registered", "Your record was created and you were assigned to a doctor. Please wait to be called.")
    db.commit()
    _invite_if_needed(db, user, patient)
    flush_sms()
    return _detail(db, enc)


@router.post("/{cid}/confirm")
def confirm_patient(cid: int, user=Depends(write), db: Session = Depends(get_db)):
    """The assigned doctor confirms the patient and calls them in for the consultation."""
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "awaiting_doctor")
    if user.role != "admin" and enc.doctor_id not in (None, user.id):
        raise HTTPException(403, "This patient is assigned to another doctor.")
    enc.stage, enc.doctor_id, enc.doctor_name = "with_doctor", user.id, user.full_name
    _event(db, enc, user, "doctor_confirmed", "Doctor confirmed the patient and started the consultation")
    flow.tell_patient(db, enc, "The doctor is ready for you", "Please go in for your consultation.")
    db.commit()
    flush_sms()
    return _detail(db, enc)


class NurseIn(BaseModel):
    nurse_id: int | None = None
    room: str | None = None
    bed: str | None = None


@router.post("/{cid}/assign-nurse")
def assign_nurse(cid: int, body: NurseIn, user=Depends(write), db: Session = Depends(get_db)):
    """The doctor assigns the patient to a nurse, and to a room and bed."""
    need(user, "doctor")
    enc = _get(db, user, cid)
    if enc.stage == "completed":
        raise HTTPException(400, "This case is already complete.")
    nurse = None
    if body.nurse_id:
        nurse = db.query(User).filter(User.id == body.nurse_id, User.clinic_id == user.clinic_id, User.is_active.is_(True)).first()
        if not nurse or nurse.role != "nurse":
            raise HTTPException(422, "Choose a nurse from this clinic.")
    enc.nurse_id, enc.nurse_name = (nurse.id, nurse.full_name) if nurse else (None, None)
    enc.room, enc.bed = (body.room or "").strip() or None, (body.bed or "").strip() or None
    where = ", ".join(x for x in (f"room {enc.room}" if enc.room else "", f"bed {enc.bed}" if enc.bed else "") if x)
    _event(db, enc, user, "nurse_assigned", (f"Nurse assigned. " if nurse else "") + (where.capitalize() if where else ""))
    if nurse:
        notify_ = f"Patient {db.get(Patient, enc.patient_id).full_name} ({enc.case_no})" + (f" in {where}" if where else "")
        from ..notify import notify
        notify(db, "A patient was assigned to you", notify_, users=[nurse], link="/app/cases", kind="journey", clinic_id=enc.clinic_id)
    flow.tell_patient(db, enc, "A nurse was assigned to you", ("You are in " + where + ". ") if where else "A nurse will look after you.")
    db.commit()
    flush_sms()
    return _detail(db, enc)


class CallIn(BaseModel):
    message: str | None = None


@router.post("/{cid}/call-patient")
def call_patient(cid: int, body: CallIn, user=Depends(write), db: Session = Depends(get_db)):
    """The pharmacist calls the patient and tells them anything else that is needed (for example, a drug is out of stock)."""
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy", "awaiting_payment")
    msg = (body.message or "").strip() or "Please come to the pharmacy."
    _event(db, enc, user, "patient_called", msg[:300])
    flow.tell_patient(db, enc, "The pharmacy is calling you", msg[:300])
    db.commit()
    flush_sms()
    return _detail(db, enc)


@router.post("/open", status_code=201)
def open_case(body: OpenIn, user=Depends(write), db: Session = Depends(get_db)):
    """A doctor receives a patient directly (clinics without a receptionist): the consultation starts at once."""
    need(user, "doctor")
    patient, new = _patient_for(db, user, body)
    enc = _new_encounter(db, user, patient, new, "with_doctor", user)
    _event(db, enc, user, "opened", (f"New patient registered. " if new else f"Returning patient, visit {enc.visit_no}. ") + f"Consultation started for {patient.full_name}")
    log(db, user, "cases", "created", f"{user.full_name} received {patient.full_name} (case {enc.case_no}, visit {enc.visit_no})", {"case": enc.case_no, "new_patient": new})
    flow.tell_patient(db, enc, "You are registered", "Your record was created and your consultation has started.")
    db.commit()
    _invite_if_needed(db, user, patient)
    flush_sms()
    return _detail(db, enc)


class ConsultIn(BaseModel):
    complaints: str | None = None
    diagnosis: str | None = None
    treatment_notes: str | None = None
    temperature: str | None = None
    blood_pressure: str | None = None
    pulse: str | None = None
    weight: str | None = None
    consultation_fee: float | None = Field(default=None, ge=0)     # the doctor must set it before sending the patient on; it can be 0


@router.patch("/{cid}/consultation")
def save_consultation(cid: int, body: ConsultIn, user=Depends(write), db: Session = Depends(get_db)):
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "with_doctor", "back_to_doctor")
    changed = []
    if body.consultation_fee is not None and body.consultation_fee != enc.consult_fee:
        fee = round(body.consultation_fee, 2)
        line = db.query(CaseCharge).filter(CaseCharge.encounter_id == enc.id, CaseCharge.kind == "consultation").first()
        if line:
            line.unit_price, line.amount, line.quantity = fee, fee, 1
        else:
            _charge(db, enc, user, "consultation", "Consultation fee", 1, fee)
        enc.consult_fee = fee
        changed.append("consultation fee")
    for k, v in body.model_dump(exclude={"consultation_fee"}).items():
        v = (v or "").strip() or None
        if getattr(enc, k) != v:
            setattr(enc, k, v)
            changed.append(k.replace("_", " "))
    if changed:
        _event(db, enc, user, "consultation_saved", "Updated: " + ", ".join(changed))
        log(db, user, "cases", "updated", f"{user.full_name} saved consultation notes ({enc.case_no})", {"case": enc.case_no, "updated": changed})
    db.commit()
    return _detail(db, enc)


class LabItem(BaseModel):
    test_name: str = Field(min_length=1)
    notes: str | None = None


class LabIn(BaseModel):
    tests: list[LabItem] = Field(min_length=1)
    destination: Literal["lab", "radiology"] = "lab"       # the lab technician, or the radiologist when the clinic has one


@router.post("/{cid}/lab")
def send_to_lab(cid: int, body: LabIn, user=Depends(write), db: Session = Depends(get_db)):
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "with_doctor", "back_to_doctor")
    _need_fee(enc)
    dept = body.destination
    if dept == "radiology" and not flow.has_role(db, enc.clinic_id, "radiologist"):
        raise HTTPException(400, "This clinic has no radiologist. Send the request to the lab technician instead.")
    names = []
    for t in body.tests:
        lab = LabOrder(clinic_id=enc.clinic_id, patient_id=enc.patient_id, test_name=t.test_name.strip(), notes=t.notes, status="requested",
                       requested_by=user.full_name, encounter_id=enc.id, department=dept)
        db.add(lab)
        db.flush()
        # the fee is set by the lab technician / radiologist when the result is entered, so the line starts at 0
        _charge(db, enc, user, "lab", f"{'Imaging' if dept == 'radiology' else 'Lab'}: {lab.test_name}", 1, 0, lab.id)
        names.append(lab.test_name)
    enc.stage = "at_lab"
    place = "the radiologist" if dept == "radiology" else "the laboratory"
    _event(db, enc, user, "forwarded_to_lab", f"Sent to {place}: " + ", ".join(names))
    log(db, user, "cases", "updated", f"{user.full_name} sent case {enc.case_no} to {place}: {', '.join(names)}", {"case": enc.case_no, "tests": names})
    flow.tell_roles(db, enc, ["radiologist" if dept == "radiology" else "lab_technician"], "New request from the doctor", f"Case {enc.case_no}: {', '.join(names)}", link="/app/queue")
    flow.tell_patient(db, enc, "You are being sent for tests", f"Your doctor sent you to {place} for {', '.join(names)}.")
    db.commit()
    flush_sms()
    return _detail(db, enc)


class RxItem(BaseModel):
    drug: str = Field(min_length=1)
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    quantity: float = Field(default=1, gt=0)


class PharmacyIn(BaseModel):
    prescriptions: list[RxItem] = []


@router.post("/{cid}/pharmacy")
def send_to_pharmacy(cid: int, body: PharmacyIn, user=Depends(write), db: Session = Depends(get_db)):
    """Prescribe and forward to the pharmacist. With no drugs, the case still goes to the pharmacy to be billed."""
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "with_doctor", "back_to_doctor")
    _need_fee(enc)
    came_from_lab = db.query(LabOrder).filter(LabOrder.encounter_id == enc.id).count() > 0
    drugs = []
    for r in body.prescriptions:
        db.add(Prescription(clinic_id=enc.clinic_id, patient_id=enc.patient_id, drug=r.drug.strip(), dosage=r.dosage, frequency=r.frequency, duration=r.duration, quantity=r.quantity,
                            status="pending", prescribed_by=user.full_name, encounter_id=enc.id))
        drugs.append(f"{r.drug} x{r.quantity:g}")
    enc.stage = "at_pharmacy"
    _event(db, enc, user, "forwarded_to_pharmacy", ", ".join(drugs) if drugs else "No drugs prescribed. Sent for billing")
    log(db, user, "cases", "updated", f"{user.full_name} sent case {enc.case_no} to the pharmacy", {"case": enc.case_no, "prescribed": drugs})
    flow.tell_roles(db, enc, ["pharmacist"], "New prescription from the doctor", f"Case {enc.case_no}: " + (", ".join(drugs) if drugs else "no drugs, for billing"), link="/app/cases")
    flow.tell_patient(db, enc, "Your prescription is with the pharmacy" if not came_from_lab else "Your results were approved",
                      "The doctor approved your results and sent your prescription to the pharmacy." if came_from_lab else "Please go to the pharmacy.")
    db.commit()
    flush_sms()
    return _detail(db, enc)


class Line(BaseModel):
    prescription_id: int
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class DispenseIn(BaseModel):
    lines: list[Line] = Field(min_length=1)


@router.post("/{cid}/dispense")
def dispense(cid: int, body: DispenseIn, user=Depends(write), db: Session = Depends(get_db)):
    """The pharmacist sells the drugs: records quantity and price for each, takes them off the stock, and adds them to the bill."""
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy")
    notes, flagged = [], []
    for ln in body.lines:
        rx = db.query(Prescription).filter(Prescription.id == ln.prescription_id, Prescription.encounter_id == enc.id).first()
        if not rx or rx.status != "pending":
            raise HTTPException(400, "One of the drugs is not waiting to be dispensed.")
        if rx.query_status == "open":
            raise HTTPException(400, f"{rx.drug} has an open question to the doctor. Wait for the answer before dispensing it.")
        item = db.query(InventoryItem).filter(InventoryItem.clinic_id == enc.clinic_id, func.lower(InventoryItem.name) == rx.drug.strip().lower()).first()
        used = None
        if item:
            sk.ensure_identity(db, user, item)
            used = sk.take(db, user, item, ln.quantity, f"Dispensed for case {enc.case_no} ({rx.drug})")      # oldest unexpired batch first; expired stock is never issued
            if used is None:
                raise HTTPException(400, f"Cannot dispense {rx.drug}: only {sk.good_stock(db, item):g} {item.unit or ''} that has not expired is in stock, and {ln.quantity:g} are needed. Receive stock first, or cancel this drug.")
        else:
            flagged.append(rx.drug)                                 # a drug that is not in the stock records at all: allowed, but the admin is told
        rx.status, rx.dispensed_by, rx.dispensed_at = "dispensed", user.full_name, datetime.utcnow()
        rx.dispensed_stock = used["label"] if used else "not in stock records"
        _charge(db, enc, user, "drug", f"Drug: {rx.drug}" + (f" ({rx.dosage})" if rx.dosage else ""), ln.quantity, ln.unit_price, rx.id)
        notes.append(f"{rx.drug} x{ln.quantity:g} at UGX {ln.unit_price:,.0f} ({'stock now ' + format(item.quantity, 'g') if used else 'not in stock records'})")
    if flagged:
        flow.tell_roles(db, enc, ["admin"], "Medicine not in stock records", f"Case {enc.case_no}: {', '.join(flagged)} was dispensed but is not in the stock list. Add it so its stock is tracked.", link="/app/stock")
    _event(db, enc, user, "dispensed", "; ".join(notes))
    log(db, user, "pharmacy", "dispensed", f"{user.full_name} dispensed drugs for case {enc.case_no}", {"case": enc.case_no, "dispensed": notes})   # the clinic admin sees every dispensing in the activity feed
    db.commit()
    return _detail(db, enc)


class QueryIn(BaseModel):
    message: str = Field(min_length=3, max_length=400)


@router.post("/{cid}/prescriptions/{rid}/query")
def query_rx(cid: int, rid: int, body: QueryIn, user=Depends(write), db: Session = Depends(get_db)):
    """Before dispensing, the pharmacist checks the prescription and asks the doctor about anything unclear (name, dose, quantity, instructions)."""
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy")
    rx = db.query(Prescription).filter(Prescription.id == rid, Prescription.encounter_id == enc.id, Prescription.status == "pending").first()
    if not rx:
        raise HTTPException(404, "Prescription not found.")
    rx.query_note, rx.query_status, rx.query_reply = body.message.strip(), "open", None
    _event(db, enc, user, "rx_queried", f"{rx.drug}: {rx.query_note}")
    log(db, user, "pharmacy", "queried", f"{user.full_name} asked the doctor about {rx.drug} (case {enc.case_no}): {rx.query_note}", {"case": enc.case_no})
    flow.tell_doctor(db, enc, "The pharmacist has a question", f"Case {enc.case_no}, {rx.drug}: {rx.query_note}", link="/app/desk")
    flow.tell_roles(db, enc, ["admin"], "Prescription queried", f"{rx.drug} on case {enc.case_no}: {rx.query_note}", link="/app/cases")
    db.commit()
    flush_sms()
    return _detail(db, enc)


class ReplyIn(BaseModel):
    reply: str = Field(min_length=2, max_length=400)
    drug: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    quantity: float | None = Field(default=None, gt=0)


@router.post("/{cid}/prescriptions/{rid}/reply")
def reply_rx(cid: int, rid: int, body: ReplyIn, user=Depends(write), db: Session = Depends(get_db)):
    """The doctor answers the pharmacist's question and, if needed, corrects the prescription."""
    need(user, "doctor")
    enc = _get(db, user, cid)
    rx = db.query(Prescription).filter(Prescription.id == rid, Prescription.encounter_id == enc.id, Prescription.status == "pending").first()
    if not rx or rx.query_status != "open":
        raise HTTPException(404, "There is no open question on that prescription.")
    fixed = []
    for k in ("drug", "dosage", "frequency", "duration", "quantity"):
        v = getattr(body, k)
        if v not in (None, "") and v != getattr(rx, k):
            fixed.append(f"{k} {getattr(rx, k) or '-'} -> {v}")
            setattr(rx, k, v.strip() if isinstance(v, str) else v)
    rx.query_status, rx.query_reply = "answered", body.reply.strip()
    _event(db, enc, user, "rx_answered", f"{rx.drug}: {rx.query_reply}" + (f" (corrected: {'; '.join(fixed)})" if fixed else ""))
    log(db, user, "pharmacy", "answered", f"{user.full_name} answered the pharmacist about {rx.drug} (case {enc.case_no})" + (f"; corrected {'; '.join(fixed)}" if fixed else ""), {"case": enc.case_no})
    flow.tell_roles(db, enc, ["pharmacist"], "The doctor answered", f"Case {enc.case_no}, {rx.drug}: {rx.query_reply}", link="/app/cases")
    db.commit()
    flush_sms()
    return _detail(db, enc)


@router.post("/{cid}/prescriptions/{rid}/cancel")
def cancel_rx(cid: int, rid: int, user=Depends(write), db: Session = Depends(get_db)):
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy")
    rx = db.query(Prescription).filter(Prescription.id == rid, Prescription.encounter_id == enc.id, Prescription.status == "pending").first()
    if not rx:
        raise HTTPException(404, "Prescription not found.")
    rx.status = "cancelled"
    _event(db, enc, user, "prescription_cancelled", f"{rx.drug} not supplied")
    log(db, user, "pharmacy", "cancelled", f"{user.full_name} did not supply {rx.drug} (case {enc.case_no})", {"case": enc.case_no})
    db.commit()
    return _detail(db, enc)


class ChargeIn(BaseModel):
    description: str = Field(min_length=1)
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(ge=0)


@router.post("/{cid}/charges")
def add_charge(cid: int, body: ChargeIn, user=Depends(write), db: Session = Depends(get_db)):
    """Extra items the pharmacist sells to this patient that were not prescribed."""
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy")
    _charge(db, enc, user, "drug", body.description.strip(), body.quantity, body.unit_price)
    _event(db, enc, user, "charge_added", f"{body.description} x{body.quantity:g} at UGX {body.unit_price:,.0f}")
    db.commit()
    return _detail(db, enc)


@router.post("/{cid}/bill")
def make_bill(cid: int, user=Depends(write), db: Session = Depends(get_db)):
    """One bill for the whole journey: consultation + lab + drugs."""
    need(user, "pharmacist")
    enc = _get(db, user, cid)
    _stage(enc, "at_pharmacy")
    if db.query(Prescription).filter(Prescription.encounter_id == enc.id, Prescription.status == "pending").count():
        raise HTTPException(400, "Dispense or cancel every prescribed drug before generating the bill.")
    charges = db.query(CaseCharge).filter(CaseCharge.encounter_id == enc.id).all()
    total = sum(c.amount or 0 for c in charges)
    if total <= 0:
        enc.stage, enc.closed_at = "completed", datetime.utcnow()
        _event(db, enc, user, "closed", "Nothing to pay. Case completed")
    else:
        inv = raise_invoice(db, user, enc.patient_id, f"Case {enc.case_no}: consultation, lab and drugs", total)
        enc.invoice_id, enc.stage = inv.id, "awaiting_payment"
        _event(db, enc, user, "billed", f"Bill {inv.invoice_no} for UGX {total:,.0f}")
    log(db, user, "cases", "updated", f"{user.full_name} generated the bill for case {enc.case_no} (UGX {total:,.0f})", {"case": enc.case_no, "total": total})
    if enc.stage == "awaiting_payment":
        if flow.has_role(db, enc.clinic_id, "accountant"):
            # with an accountant the pharmacist stops at the billing record: it goes to the accountant, who takes payment, stamps and prints
            flow.tell_roles(db, enc, ["accountant"], "Bill received from the pharmacy", f"Case {enc.case_no}: UGX {total:,.0f}. Review the payments, stamp and print.", link="/app/cases")
        flow.tell_patient(db, enc, "Your files are ready for payment", f"All your files are complete. Total UGX {total:,.0f}. Pay, then your document is stamped and printed.")
    else:
        flow.tell_patient(db, enc, "Your files are complete", "There is nothing to pay.")
    db.commit()
    flush_sms()
    return _detail(db, enc)
