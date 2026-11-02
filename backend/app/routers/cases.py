"""Class B patient journey ("case"): the doctor receives the patient and consults, sends them to the lab and/or the pharmacy,
the lab returns results to the doctor, the pharmacist dispenses and sells, and ONE bill (consultation + lab + drugs) is paid.
Every step is recorded with who did it and when, so the clinic admin can track it."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import module_guard
from ..models import CaseCharge, CaseEvent, Encounter, InventoryItem, Invoice, LabOrder, Patient, Payment, Prescription
from ..pricing import price_for, raise_invoice
from ..roles import ROLE_LABELS
from .records import ser

router = APIRouter(prefix="/cases", tags=["cases"])
read, write = module_guard("cases"), module_guard("cases", write=True)
KINDS = ("registration", "consultation", "lab", "drug", "other")


def need(user, *roles):
    if user.role != "admin" and user.role not in roles:
        raise HTTPException(403, "Your role cannot do this step.")


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
        "case": ser(enc), "patient": ser(db.get(Patient, enc.patient_id)),
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
                    "doctor_name": e.doctor_name, "opened_at": e.created_at.isoformat(), "closed_at": e.closed_at.isoformat() if e.closed_at else None,
                    "total": total, "paid": (inv.paid if inv else 0) or 0, "invoice_status": inv.status if inv else None,
                    "last_event": ev and {"kind": ev.kind, "user_name": ev.user_name, "role_label": ROLE_LABELS.get(ev.role, ev.role), "created_at": ev.created_at.isoformat()}})
    return out


@router.get("/{cid}")
def get_case(cid: int, user=Depends(read), db: Session = Depends(get_db)):
    return _detail(db, _get(db, user, cid))


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


@router.post("/open", status_code=201)
def open_case(body: OpenIn, user=Depends(write), db: Session = Depends(get_db)):
    """The doctor receives a patient: pick an existing patient or register a new one, and the consultation starts."""
    need(user, "doctor")
    cid, new = user.clinic_id, False
    if body.patient_id:
        patient = db.query(Patient).filter(Patient.id == body.patient_id, Patient.clinic_id == cid).first()
        if not patient:
            raise HTTPException(404, "Patient not found.")
    else:
        if not (body.full_name or "").strip() or not body.gender:
            raise HTTPException(422, "Enter the patient's name and gender, or choose an existing patient.")
        top = db.query(func.max(Patient.id)).filter(Patient.clinic_id == cid).scalar() or 0
        patient = Patient(clinic_id=cid, patient_no=f"P-{top + 1:06d}", **{k: (v or "").strip() or None for k, v in body.model_dump(exclude={"patient_id"}).items()})
        db.add(patient)
        db.flush()
        new = True
    open_case_ = db.query(Encounter).filter(Encounter.clinic_id == cid, Encounter.patient_id == patient.id, Encounter.stage != "completed").first()
    if open_case_:
        raise HTTPException(400, f"{patient.full_name} already has an open case ({open_case_.case_no}).")
    top = db.query(func.max(Encounter.id)).filter(Encounter.clinic_id == cid).scalar() or 0
    enc = Encounter(clinic_id=cid, patient_id=patient.id, case_no=f"CS-{top + 1:06d}", stage="with_doctor", doctor_id=user.id, doctor_name=user.full_name)
    db.add(enc)
    db.flush()
    if new and (fee := price_for(db, cid, "registration", "")):
        _charge(db, enc, user, "registration", "Patient registration fee", 1, fee)
    if fee := price_for(db, cid, "consultation", ""):
        _charge(db, enc, user, "consultation", f"Consultation fee ({user.full_name})", 1, fee)
    _event(db, enc, user, "opened", ("New patient registered. " if new else "") + f"Consultation started for {patient.full_name}")
    log(db, user, "cases", "created", f"{user.full_name} received {patient.full_name} (case {enc.case_no})", {"case": enc.case_no, "new_patient": new})
    db.commit()
    return _detail(db, enc)


class ConsultIn(BaseModel):
    complaints: str | None = None
    diagnosis: str | None = None
    treatment_notes: str | None = None
    temperature: str | None = None
    blood_pressure: str | None = None
    pulse: str | None = None
    weight: str | None = None


@router.patch("/{cid}/consultation")
def save_consultation(cid: int, body: ConsultIn, user=Depends(write), db: Session = Depends(get_db)):
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "with_doctor", "back_to_doctor")
    changed = []
    for k, v in body.model_dump().items():
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


@router.post("/{cid}/lab")
def send_to_lab(cid: int, body: LabIn, user=Depends(write), db: Session = Depends(get_db)):
    need(user, "doctor")
    enc = _get(db, user, cid)
    _stage(enc, "with_doctor", "back_to_doctor")
    names = []
    for t in body.tests:
        lab = LabOrder(clinic_id=enc.clinic_id, patient_id=enc.patient_id, test_name=t.test_name.strip(), notes=t.notes, status="requested",
                       requested_by=user.full_name, encounter_id=enc.id)
        db.add(lab)
        db.flush()
        _charge(db, enc, user, "lab", f"Lab: {lab.test_name}", 1, price_for(db, enc.clinic_id, "lab", lab.test_name), lab.id)
        names.append(lab.test_name)
    enc.stage = "at_lab"
    _event(db, enc, user, "forwarded_to_lab", ", ".join(names))
    log(db, user, "cases", "updated", f"{user.full_name} sent case {enc.case_no} to the lab: {', '.join(names)}", {"case": enc.case_no, "tests": names})
    db.commit()
    return _detail(db, enc)


class RxItem(BaseModel):
    drug: str = Field(min_length=1)
    dosage: str | None = None
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
    drugs = []
    for r in body.prescriptions:
        db.add(Prescription(clinic_id=enc.clinic_id, patient_id=enc.patient_id, drug=r.drug.strip(), dosage=r.dosage, duration=r.duration, quantity=r.quantity,
                            status="pending", prescribed_by=user.full_name, encounter_id=enc.id))
        drugs.append(f"{r.drug} x{r.quantity:g}")
    enc.stage = "at_pharmacy"
    _event(db, enc, user, "forwarded_to_pharmacy", ", ".join(drugs) if drugs else "No drugs prescribed. Sent for billing")
    log(db, user, "cases", "updated", f"{user.full_name} sent case {enc.case_no} to the pharmacy", {"case": enc.case_no, "prescribed": drugs})
    db.commit()
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
    notes = []
    for ln in body.lines:
        rx = db.query(Prescription).filter(Prescription.id == ln.prescription_id, Prescription.encounter_id == enc.id).first()
        if not rx or rx.status != "pending":
            raise HTTPException(400, "One of the drugs is not waiting to be dispensed.")
        rx.status = "dispensed"
        _charge(db, enc, user, "drug", f"Drug: {rx.drug}" + (f" ({rx.dosage})" if rx.dosage else ""), ln.quantity, ln.unit_price, rx.id)
        item = db.query(InventoryItem).filter(InventoryItem.clinic_id == enc.clinic_id, func.lower(InventoryItem.name) == rx.drug.strip().lower()).first()
        if item and (item.quantity or 0) >= ln.quantity:
            item.quantity -= ln.quantity
            stock = f"stock now {item.quantity:g}"
        else:
            stock = "not taken off stock"
        notes.append(f"{rx.drug} x{ln.quantity:g} at UGX {ln.unit_price:,.0f} ({stock})")
    _event(db, enc, user, "dispensed", "; ".join(notes))
    log(db, user, "cases", "updated", f"{user.full_name} dispensed drugs for case {enc.case_no}", {"case": enc.case_no, "sold": notes})
    db.commit()
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
    db.commit()
    return _detail(db, enc)
