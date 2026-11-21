from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import clinic_member
from ..models import Appointment, Encounter, ImagingOrder, LabOrder, Patient, Prescription, Visit
from ..roles import PATIENT_FILE_ROLES, module_level
from .records import ser

router = APIRouter(prefix="/records", tags=["patient-file"])
SECTIONS = {"visits": Visit, "appointments": Appointment, "lab": LabOrder, "pharmacy": Prescription, "imaging": ImagingOrder}


@router.get("/patient/{pid}")
def patient_file(pid: int, user=Depends(clinic_member), db: Session = Depends(get_db)):
    if user.role not in PATIENT_FILE_ROLES:
        raise HTTPException(403, "Your role cannot open patient files.")
    p = db.query(Patient).filter(Patient.id == pid, Patient.clinic_id == user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Patient not found.")
    out = {"patient": ser(p)}
    for key, model in SECTIONS.items():
        if module_level(user.clinic.clinic_class, user.role, key):
            out[key] = [ser(x) for x in db.query(model).filter(model.clinic_id == user.clinic_id, model.patient_id == pid)
                        .order_by(model.id.desc()).limit(200)]
    if module_level(user.clinic.clinic_class, user.role, "cases"):     # the patient's case files, newest first, so the latest one can be printed and stamped
        out["cases"] = [{"id": e.id, "case_no": e.case_no, "doctor_name": e.doctor_name, "stage": e.stage, "diagnosis": e.diagnosis,
                         "created_at": e.created_at.isoformat(), "closed_at": e.closed_at.isoformat() if e.closed_at else None}
                        for e in db.query(Encounter).filter(Encounter.clinic_id == user.clinic_id, Encounter.patient_id == pid).order_by(Encounter.id.desc()).limit(50)]
    return out
