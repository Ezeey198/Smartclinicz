import json
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import clinic_admin_only
from ..models import Activity

router = APIRouter(prefix="/activity", tags=["activity"])


def _item(a):
    return {"id": a.id, "user_id": a.user_id, "user_name": a.user_name, "role": a.role, "module": a.module, "action": a.action,
            "summary": a.summary, "details": json.loads(a.details) if a.details else None, "created_at": a.created_at.isoformat()}


@router.get("")
def feed(module: str | None = None, user_id: int | None = None, limit: int = 200, admin=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    q = db.query(Activity).filter(Activity.clinic_id == admin.clinic_id)
    if module:
        q = q.filter(Activity.module == module)
    if user_id:
        q = q.filter(Activity.user_id == user_id)
    return {"last_seen": admin.last_seen_activity_id or 0, "items": [_item(a) for a in q.order_by(Activity.id.desc()).limit(min(limit, 500))]}


@router.get("/unread")
def unread(admin=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    q = db.query(Activity).filter(Activity.clinic_id == admin.clinic_id, Activity.id > (admin.last_seen_activity_id or 0), Activity.user_id != admin.id)
    return {"count": q.count(), "latest": [_item(a) for a in q.order_by(Activity.id.desc()).limit(5)]}


@router.post("/seen")
def seen(admin=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    admin.last_seen_activity_id = db.query(func.coalesce(func.max(Activity.id), 0)).filter(Activity.clinic_id == admin.clinic_id).scalar()
    db.commit()
    return {"ok": True}
