"""My own profile: personal details (not the email), picture, colour theme."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import current_user
from .auth import me_payload

router = APIRouter(prefix="/profile", tags=["profile"])
THEMES = ("teal", "ocean", "forest", "violet", "sunset", "rose", "slate")


@router.patch("")
def update_me(payload: dict = Body(...), user=Depends(current_user), db: Session = Depends(get_db)):
    """Personal information. The email address cannot be changed here."""
    if "full_name" in payload:
        name = (payload["full_name"] or "").strip()
        if len(name) < 2:
            raise HTTPException(422, "Enter your full name.")
        user.full_name = name[:150]
    if "phone" in payload:
        user.phone = (payload["phone"] or "").strip()[:50] or None
    db.commit()
    return me_payload(user)


@router.put("/avatar")
def set_avatar(payload: dict = Body(...), user=Depends(current_user), db: Session = Depends(get_db)):
    img = payload.get("image") or ""
    if not img.startswith("data:image/") or ";base64," not in img[:60]:
        raise HTTPException(422, "Choose a picture (JPG, PNG or WebP).")
    if len(img) > 400_000:
        raise HTTPException(413, "That picture is too large. Choose a smaller one.")
    user.avatar = img
    db.commit()
    return {"avatar": user.avatar}


@router.delete("/avatar")
def remove_avatar(user=Depends(current_user), db: Session = Depends(get_db)):
    user.avatar = None
    db.commit()
    return {"avatar": None}


@router.put("/theme")
def set_theme(payload: dict = Body(...), user=Depends(current_user), db: Session = Depends(get_db)):
    """The colour and theme apply to this person's pages only."""
    t = payload.get("theme")
    if t not in THEMES:
        raise HTTPException(422, "Unknown theme.")
    user.theme = t
    db.commit()
    return {"theme": t}
