"""The patient's own page. The patient accepts the account from an email link, signs in, follows every step of the visit with a message for
each one, and saves the final stamped document. The session lasts from reception until the document is saved, then ends five minutes later.
Nothing here shows a staff name."""
import json
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .. import flow
from ..config import settings
from ..database import get_db
from ..deps import bearer
from ..models import CaseEvent, Clinic, Encounter, Notification, Patient
from ..security import hash_password, verify_password

router = APIRouter(prefix="/portal", tags=["patient"])
GRACE = timedelta(minutes=5)
STAGE_LABEL = {"awaiting_doctor": "Waiting for your doctor", "with_doctor": "With the doctor", "at_lab": "Sent for tests", "back_to_doctor": "Results are with the doctor",
               "at_pharmacy": "At the pharmacy", "awaiting_payment": "Ready for payment, stamping and printing", "completed": "Complete"}


def _token(pid: int) -> str:
    return jwt.encode({"pat": pid, "exp": datetime.now(timezone.utc) + timedelta(hours=settings.TOKEN_HOURS)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _visits(db, p):
    return db.query(Encounter).filter(Encounter.patient_id == p.id).order_by(Encounter.id.desc()).all()


def session_open(db, p) -> bool:
    """The page is open while a visit is in progress, or while the finished document has not been saved yet."""
    if p.portal_session_until and p.portal_session_until < datetime.utcnow():
        return False
    return any(e.stage != "completed" or (e.final_doc and not e.doc_saved_at) for e in _visits(db, p))


def current_patient(creds=Depends(bearer), db: Session = Depends(get_db)) -> Patient:
    if not creds:
        raise HTTPException(401, "Please sign in.")
    try:
        data = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has ended. Please sign in again.")
    p = db.get(Patient, int(data["pat"])) if data.get("pat") else None
    if not p or not p.portal_active:
        raise HTTPException(401, "Please sign in.")
    if p.portal_session_until and p.portal_session_until < datetime.utcnow():
        raise HTTPException(401, "Your session has ended. Your page opens again at your next visit.")
    return p


@router.get("/preview/{token}")
def preview(token: str, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.portal_token == token).first()
    if not p or (p.portal_token_expires and p.portal_token_expires < datetime.utcnow()):
        raise HTTPException(404, "This link is invalid or has expired. Ask the clinic to send a new one.")
    return {"full_name": p.full_name, "clinic_name": db.get(Clinic, p.clinic_id).name, "clinic_code": db.get(Clinic, p.clinic_id).code}


class ActivateIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=100)


@router.post("/activate")
def activate(body: ActivateIn, db: Session = Depends(get_db)):
    """The patient accepts and approves their page and chooses a password."""
    p = db.query(Patient).filter(Patient.portal_token == body.token).first()
    if not p or (p.portal_token_expires and p.portal_token_expires < datetime.utcnow()):
        raise HTTPException(404, "This link is invalid or has expired. Ask the clinic to send a new one.")
    p.portal_password_hash, p.portal_active, p.portal_token, p.portal_token_expires = hash_password(body.password), True, None, None
    db.commit()
    c = db.get(Clinic, p.clinic_id)
    return {"clinic_code": c.code, "clinic_name": c.name, "email": p.email}


class LoginIn(BaseModel):
    clinic_code: str
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    c = db.query(Clinic).filter(Clinic.code == body.clinic_code.strip().upper()).first()
    rows = c and db.query(Patient).filter(Patient.clinic_id == c.id, Patient.email == body.email.strip().lower(), Patient.portal_active.is_(True)).all()
    p = next((x for x in (rows or []) if verify_password(body.password, x.portal_password_hash)), None)
    if not p:
        raise HTTPException(401, "Wrong clinic code, email or password.")
    if not session_open(db, p):
        raise HTTPException(403, "Your page is closed. It opens again when you next visit the clinic.")
    return {"token": _token(p.id), "patient": {"id": p.id, "full_name": p.full_name}}


def _current_visit(db, p):
    vs = _visits(db, p)
    return next((e for e in vs if e.stage != "completed" or (e.final_doc and not e.doc_saved_at)), vs[0] if vs else None)


@router.get("/me")
def me(p: Patient = Depends(current_patient), db: Session = Depends(get_db)):
    e = _current_visit(db, p)
    c = db.get(Clinic, p.clinic_id)
    unread = db.query(Notification).filter(Notification.patient_id == p.id, Notification.read_at.is_(None)).count()
    steps = []
    if e:
        steps = [{"at": ev.created_at.isoformat(), "step": flow.STEP_TEXT[ev.kind]} for ev in db.query(CaseEvent).filter(CaseEvent.encounter_id == e.id).order_by(CaseEvent.id) if ev.kind in flow.STEP_TEXT]
    return {"patient": {"full_name": p.full_name, "patient_no": p.patient_no}, "clinic": {"name": c.name, "phone": c.phone},
            "visit": e and {"case_no": e.case_no, "visit_no": e.visit_no, "stage": e.stage, "stage_label": STAGE_LABEL.get(e.stage, e.stage), "room": e.room, "bed": e.bed},
            "steps": steps, "document_ready": bool(e and e.final_doc), "document_saved": bool(e and e.doc_saved_at),
            "session_ends_at": p.portal_session_until.isoformat() + "Z" if p.portal_session_until else None, "unread": unread}


@router.get("/notifications")
def notifications(p: Patient = Depends(current_patient), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.patient_id == p.id).order_by(Notification.id.desc()).limit(60).all()
    for n in rows:
        if not n.read_at:
            n.read_at = datetime.utcnow()
    db.commit()
    return [{"id": n.id, "title": n.title, "body": n.body, "created_at": n.created_at.isoformat()} for n in rows]


@router.get("/document")
def document(p: Patient = Depends(current_patient), db: Session = Depends(get_db)):
    """The finished, stamped case file. It has the patient's details and the workflow only, never a staff name."""
    e = _current_visit(db, p)
    if not e or not e.final_doc:
        raise HTTPException(404, "Your document is not ready yet. You will get a message when it is.")
    c = db.get(Clinic, p.clinic_id)
    return {**json.loads(e.final_doc), "stamp": {"image": c.stamp_image, "ink": c.stamp_ink or "#1b3a8a"}, "saved": bool(e.doc_saved_at)}


@router.post("/document/saved")
def document_saved(p: Patient = Depends(current_patient), db: Session = Depends(get_db)):
    """The patient saved the PDF to their device. The page shows an alert for five minutes, then the session ends."""
    e = _current_visit(db, p)
    if not e or not e.final_doc:
        raise HTTPException(400, "There is no document to save yet.")
    e.doc_saved_at = e.doc_saved_at or datetime.utcnow()
    p.portal_session_until = datetime.utcnow() + GRACE
    db.commit()
    return {"session_ends_at": p.portal_session_until.isoformat() + "Z"}
