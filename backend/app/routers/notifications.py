from datetime import datetime
from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import current_user
from ..models import Notification
from ..notify import flush_sms
from .. import alerts

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _row(n):
    return {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link, "read": n.read_at is not None, "created_at": n.created_at.isoformat()}


@router.get("")
def mine(user=Depends(current_user), db: Session = Depends(get_db)):
    """My latest notifications and how many are unread. The page polls this to blink the bell."""
    if not user.is_superadmin:
        alerts.twice_daily(db, user)          # stock and expiry alerts for the lab technician and pharmacist, at most twice a day
    q = db.query(Notification).filter(Notification.user_id == user.id)
    unread = q.filter(Notification.read_at.is_(None)).count()
    rows = q.order_by(Notification.id.desc()).limit(60).all()
    flush_sms()
    return {"unread": unread, "items": [_row(n) for n in rows]}


@router.post("/read")
def mark_read(payload: dict = Body(default={}), user=Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Notification).filter(Notification.user_id == user.id, Notification.read_at.is_(None))
    if payload.get("ids"):
        q = q.filter(Notification.id.in_([int(i) for i in payload["ids"]]))
    for n in q.all():
        n.read_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
