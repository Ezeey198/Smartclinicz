"""Attendance: everyone clocks in from the clinic. The phone's position must be within 20 metres of the location the admin saved."""
import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only, clinic_member
from ..models import Attendance

router = APIRouter(prefix="/attendance", tags=["attendance"])
RADIUS_M = 20
WORST_ACCURACY_M = 60      # a GPS reading that vague cannot prove someone is within 20 metres


def metres(lat1, lon1, lat2, lon2):
    """Distance between two points on the earth (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def _row(a):
    return {"id": a.id, "user_id": a.user_id, "user_name": a.user_name, "clock_in": a.clock_in.isoformat(), "clock_out": a.clock_out.isoformat() if a.clock_out else None,
            "distance_m": round(a.distance_m or 0, 1)}


def _open(db, user):
    return db.query(Attendance).filter(Attendance.user_id == user.id, Attendance.clock_out.is_(None)).order_by(Attendance.id.desc()).first()


@router.get("/status")
def status(user=Depends(clinic_member), db: Session = Depends(get_db)):
    c = user.clinic
    a = _open(db, user)
    return {"clocked_in": bool(a), "since": a.clock_in.isoformat() if a else None, "location_set": c.latitude is not None and c.longitude is not None, "radius_m": RADIUS_M}


@router.post("/clock-in")
def clock_in(payload: dict = Body(...), user=Depends(clinic_member), db: Session = Depends(get_db)):
    c = user.clinic
    if c.latitude is None or c.longitude is None:
        raise HTTPException(400, "The clinic admin has not saved the exact location of the clinic yet, so attendance cannot be taken.")
    try:
        lat, lng = float(payload["latitude"]), float(payload["longitude"])
        acc = float(payload.get("accuracy") or 0)
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, "Your position was not sent. Allow location access and try again.")
    if acc > WORST_ACCURACY_M:
        raise HTTPException(400, f"Your phone could only find your position to within {acc:.0f} m. Step outside or turn GPS on, then try again.")
    d = metres(lat, lng, c.latitude, c.longitude)
    if d > RADIUS_M:
        raise HTTPException(400, f"You are about {d:.0f} m from the {('pharmacy' if c.clinic_class == 'P' else 'clinic')}. You must be within {RADIUS_M} m to clock in.")
    if _open(db, user):
        raise HTTPException(400, "You are already clocked in.")
    a = Attendance(clinic_id=user.clinic_id, user_id=user.id, user_name=user.full_name, latitude=lat, longitude=lng, distance_m=d, accuracy_m=acc)
    db.add(a)
    log(db, user, "attendance", "clock_in", f"{user.full_name} clocked in at the {('pharmacy' if c.clinic_class == 'P' else 'clinic')}", {"distance_m": round(d, 1)})
    db.commit()
    return _row(a)


@router.post("/clock-out")
def clock_out(user=Depends(clinic_member), db: Session = Depends(get_db)):
    a = _open(db, user)
    if not a:
        raise HTTPException(400, "You are not clocked in.")
    a.clock_out = datetime.utcnow()
    log(db, user, "attendance", "clock_out", f"{user.full_name} clocked out")
    db.commit()
    return _row(a)


@router.get("")
def report(days: int = 14, admin=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=min(max(days, 1), 120))
    rows = db.query(Attendance).filter(Attendance.clinic_id == admin.clinic_id, Attendance.clock_in >= since).order_by(Attendance.id.desc()).limit(1000).all()
    return [_row(a) for a in rows]
