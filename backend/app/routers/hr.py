from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import module_guard
from ..models import User
from ..roles import ROLE_LABELS

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/staff")
def staff_directory(user=Depends(module_guard("hr")), db: Session = Depends(get_db)):
    rows = db.query(User).filter(User.clinic_id == user.clinic_id).order_by(User.full_name).all()
    return [{"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "role": u.role,
             "role_label": ROLE_LABELS.get(u.role, u.role),
             "state": "active" if u.is_active else ("pending" if not u.password_hash else "inactive"),
             "joined": u.created_at.isoformat() if u.created_at else None} for u in rows]
