"""The public website: anyone can read the About page, the list of clinics and pharmacies, and each one's public page.
Only the superadmin can edit the About content (PUT /public/about). Each clinic's own admin manages its page in public_page.py."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, defer
from ..database import get_db
from ..deps import superadmin_only
from ..models import Clinic, MediaItem, SiteContent

router = APIRouter(prefix="/public", tags=["public"])

DEFAULT_ABOUT = {
    "headline": "One system for clinics and pharmacies",
    "title": "About ClinicPro",
    "intro": "ClinicPro helps clinics and pharmacies run patient care, stock, billing and staff in one place, and lets the public find them online.",
    "sections": [
        {"heading": "For clinics", "text": "Patient records, appointments, consultations, laboratory, imaging, pharmacy, billing and staff, with every role working in its own space."},
        {"heading": "For pharmacies", "text": "A point of sale for sellers, stock kept in batches with expiry dates, suppliers and purchases, and sales reports for the pharmacy admin."},
        {"heading": "Accountable", "text": "Every action is recorded with who did it and when, and the clinic admin is alerted. Documents carry the clinic's digital stamp with the name of the person who used it."},
        {"heading": "Online anywhere", "text": "Staff sign in from any device. Each clinic and pharmacy has its own public page with photos, services, locations and videos."},
    ],
    "clinics_intro": "Browse the clinics and pharmacies on ClinicPro. Open one to see its services, photos, locations and videos.",
    "features": [
        {"heading": "Clinic", "text": "Admin, doctor, nurse, lab technician and pharmacist, with the patient journey from doctor to laboratory to pharmacy, one combined bill and one case file for every patient."},
        {"heading": "Pharmacy", "text": "Point of sale, batch and expiry tracking, suppliers and purchases, prescription control, wallet and sales reports."},
    ],
}


def get_about(db: Session) -> dict:
    row = db.get(SiteContent, "about")
    return {**DEFAULT_ABOUT, **(json.loads(row.value) if row else {})}


@router.get("/about")
def about(db: Session = Depends(get_db)):
    return get_about(db)


class Item(BaseModel):
    heading: str = Field(max_length=120)
    text: str = Field(max_length=3000)


class AboutIn(BaseModel):
    headline: str = Field(max_length=160)
    title: str = Field(max_length=120)
    intro: str = Field(max_length=2000)
    sections: list[Item] = Field(max_length=12)
    clinics_intro: str = Field(max_length=2000)
    features: list[Item] = Field(max_length=12)


@router.put("/about")
def save_about(body: AboutIn, _=Depends(superadmin_only), db: Session = Depends(get_db)):
    row = db.get(SiteContent, "about") or SiteContent(key="about")
    row.value, row.updated_at = json.dumps(body.model_dump()), datetime.utcnow()
    db.add(row)
    db.commit()
    return get_about(db)


# ------------------------------------------------------------------ clinics and pharmacies
DEFAULT_PROFILE = {"listed": True, "show_contact": True, "tagline": "", "about": "", "hours": "", "services": [], "locations": []}


def profile_of(c: Clinic) -> dict:
    try:
        saved = json.loads(c.public_profile) if c.public_profile else {}
    except ValueError:
        saved = {}
    return {**DEFAULT_PROFILE, **saved}


def _visible(db, code):
    c = db.query(Clinic).filter(Clinic.code == code.strip().upper(), Clinic.status == "active", Clinic.approved_at.isnot(None)).first()
    if not c or not profile_of(c)["listed"]:
        raise HTTPException(404, "This page does not exist or is not public.")
    return c


def media_of(db, clinic_id):
    rows = db.query(MediaItem).options(defer(MediaItem.blob)).filter(MediaItem.clinic_id == clinic_id).order_by(MediaItem.id).all()
    photos = [{"id": m.id, "caption": m.title} for m in rows if m.kind == "photo"]
    videos = [{"id": m.id, "title": m.title, "source": m.source, "url": m.url if m.source != "file" else None} for m in rows if m.kind == "video"]
    return photos, videos


@router.get("/clinics")
def clinics(type: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    covers = {}
    for m in db.query(MediaItem.clinic_id, MediaItem.id).filter(MediaItem.kind == "photo").order_by(MediaItem.id):
        covers.setdefault(m.clinic_id, m.id)
    out, term = [], (q or "").strip().lower()
    for c in db.query(Clinic).filter(Clinic.status == "active", Clinic.approved_at.isnot(None)).order_by(Clinic.name):
        p = profile_of(c)
        kind = "pharmacy" if c.clinic_class == "P" else "clinic"
        if not p["listed"] or (type in ("clinic", "pharmacy") and kind != type):
            continue
        hay = f"{c.name} {c.city} {c.district} {c.country} {p['tagline']} {' '.join(s['name'] for s in p['services'])}".lower()
        if term and term not in hay:
            continue
        out.append({"code": c.code, "name": c.name, "type": kind, "clinic_class": c.clinic_class, "city": c.city, "country": c.country, "tagline": p["tagline"],
                    "cover_id": covers.get(c.id), "services": [s["name"] for s in p["services"][:4]]})
    return out


@router.get("/clinics/{code}")
def clinic_page(code: str, db: Session = Depends(get_db)):
    c = _visible(db, code)
    p = profile_of(c)
    photos, videos = media_of(db, c.id)
    locations = p["locations"] or [{"label": "Main location", "address": c.address or "", "city": c.city or "", "hours": p["hours"], "phone": c.phone or "", "map_url": ""}]
    return {"code": c.code, "name": c.name, "type": "pharmacy" if c.clinic_class == "P" else "clinic", "clinic_class": c.clinic_class,
            "tagline": p["tagline"], "about": p["about"] or c.description or "", "hours": p["hours"], "services": p["services"], "locations": locations,
            "contact": {"phone": c.phone, "email": c.email, "website": c.website} if p["show_contact"] else None,
            "address": ", ".join(x for x in [c.address, c.city, c.district, c.country] if x), "photos": photos, "videos": videos}


@router.get("/media/{mid}")
def media(mid: int, request: Request, db: Session = Depends(get_db)):
    m = db.query(MediaItem).filter(MediaItem.id == mid).first()
    c = m and db.get(Clinic, m.clinic_id)
    if not m or not m.blob or not c or c.status != "active":
        raise HTTPException(404, "Not found.")
    data, total = m.blob, len(m.blob)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    rng = request.headers.get("range", "")
    if rng.startswith("bytes="):            # browsers ask for video in pieces so it can be skipped through
        try:
            a, _, b = rng[6:].partition("-")
            start, end = int(a or 0), min(int(b) if b else total - 1, total - 1)
            if start > end or start >= total:
                raise ValueError
            return Response(data[start:end + 1], status_code=206, media_type=m.mime, headers={**headers, "Content-Range": f"bytes {start}-{end}/{total}"})
        except ValueError:
            pass
    return Response(data, media_type=m.mime, headers=headers)
