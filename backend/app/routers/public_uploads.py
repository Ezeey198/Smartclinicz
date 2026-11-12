"""Photo and video uploads for the public page.
This lives in its own file because FastAPI needs the python-multipart package just to define an upload route. If that package is
missing on the server, main.py skips this file and the rest of the app still starts."""
import re
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only
from ..models import MediaItem
from .public_page import _view

router = APIRouter(prefix="/clinic/public", tags=["public-page"])
MAX_PHOTOS, MAX_VIDEOS = 30, 8
MAX_PHOTO, MAX_VIDEO = 3_000_000, 25_000_000


def _sniff_image(b: bytes):
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"


def _sniff_video(b: bytes):
    if b[4:8] == b"ftyp":
        return "video/mp4"
    if b[:4] == b"\x1aE\xdf\xa3":
        return "video/webm"


def _count(db, user, kind):
    return db.query(MediaItem.id).filter(MediaItem.clinic_id == user.clinic_id, MediaItem.kind == kind).count()


@router.post("/photos", status_code=201)
async def add_photo(file: UploadFile = File(...), caption: str = Form(""), user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_PHOTO:
        raise HTTPException(413, "That photo is too large. Use one under 3 MB.")
    mime = _sniff_image(data)
    if not mime:
        raise HTTPException(422, "Upload a JPEG, PNG or WebP photo.")
    if _count(db, user, "photo") >= MAX_PHOTOS:
        raise HTTPException(400, f"A page can have up to {MAX_PHOTOS} photos. Delete one first.")
    db.add(MediaItem(clinic_id=user.clinic_id, kind="photo", source="file", title=caption.strip()[:200] or None, mime=mime, blob=data, size=len(data)))
    log(db, user, "public_page", "created", f"{user.full_name} added a photo to the public page")
    db.commit()
    return _view(db, user)


def _embed(url: str):
    u = url.strip()
    m = re.match(r"https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})", u)
    if m:
        return "youtube", f"https://www.youtube.com/embed/{m.group(1)}"
    m = re.match(r"https?://(?:www\.)?vimeo\.com/(?:video/)?(\d+)", u)
    if m:
        return "vimeo", f"https://player.vimeo.com/video/{m.group(1)}"
    if re.match(r"https://\S+\.(mp4|webm)(\?\S*)?$", u, re.I):
        return "direct", u
    raise HTTPException(422, "Use a YouTube or Vimeo link, a direct https link to an MP4 or WebM file, or upload a video file.")


@router.post("/videos", status_code=201)
async def add_video(title: str = Form(""), url: str = Form(""), file: UploadFile | None = File(None), user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    if _count(db, user, "video") >= MAX_VIDEOS:
        raise HTTPException(400, f"A page can have up to {MAX_VIDEOS} videos. Delete one first.")
    have_file = file is not None and bool(file.filename)
    if have_file == bool(url.strip()):
        raise HTTPException(422, "Add either a video link or a video file, not both.")
    if have_file:
        data = await file.read()
        if len(data) > MAX_VIDEO:
            raise HTTPException(413, "That video is too large. Upload one under 25 MB, or add a YouTube or Vimeo link instead.")
        mime = _sniff_video(data)
        if not mime:
            raise HTTPException(422, "Upload an MP4 or WebM video.")
        item = MediaItem(clinic_id=user.clinic_id, kind="video", source="file", title=title.strip()[:200] or None, mime=mime, blob=data, size=len(data))
    else:
        source, embed = _embed(url)
        item = MediaItem(clinic_id=user.clinic_id, kind="video", source=source, title=title.strip()[:200] or None, url=embed)
    db.add(item)
    log(db, user, "public_page", "created", f"{user.full_name} added a video to the public page")
    db.commit()
    return _view(db, user)
