from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import clinic_member
from ..models import Appointment, ImagingOrder, LabOrder, Patient, Prescription, Visit
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
    return out
