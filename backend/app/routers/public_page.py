"""A clinic's or pharmacy's own admin manages what its public page shows: text, services, locations, photos and videos."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, defer
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only
from ..models import MediaItem
from .public import media_of, profile_of

router = APIRouter(prefix="/clinic/public", tags=["public-page"])


class Service(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=400)
    price: str | None = Field(default=None, max_length=60)


class Location(BaseModel):
    label: str | None = Field(default=None, max_length=80)
    address: str = Field(min_length=1, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    hours: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=50)
    map_url: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)       # exact position, detected by the admin
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _both_or_neither(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Give both latitude and longitude, or leave both empty.")
        return self


class ProfileIn(BaseModel):
    listed: bool = True
    show_contact: bool = True
    tagline: str | None = Field(default="", max_length=160)
    about: str | None = Field(default="", max_length=4000)
    hours: str | None = Field(default="", max_length=300)
    services: list[Service] = Field(default=[], max_length=60)
    locations: list[Location] = Field(default=[], max_length=10)


def _view(db, user):
    photos, videos = media_of(db, user.clinic_id)
    return {"code": user.clinic.code, "type": "pharmacy" if user.clinic.clinic_class == "P" else "clinic", "profile": profile_of(user.clinic), "photos": photos, "videos": videos}


@router.get("")
def get_page(user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    return _view(db, user)


@router.put("")
def save_page(body: ProfileIn, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    user.clinic.public_profile = json.dumps(body.model_dump())
    log(db, user, "public_page", "updated", f"{user.full_name} updated the public page", {"listed": body.listed, "services": len(body.services), "locations": len(body.locations)})
    db.commit()
    return _view(db, user)


@router.delete("/media/{mid}")
def delete_media(mid: int, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    m = db.query(MediaItem).options(defer(MediaItem.blob)).filter(MediaItem.id == mid, MediaItem.clinic_id == user.clinic_id).first()
    if not m:
        raise HTTPException(404, "Not found.")
    kind = m.kind
    db.delete(m)
    log(db, user, "public_page", "deleted", f"{user.full_name} removed a {kind} from the public page")
    db.commit()
    return _view(db, user)
