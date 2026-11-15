"""Chat between the people of one clinic, and an AI assistant."""
from datetime import datetime
import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..deps import clinic_member
from ..models import ChatMessage, User
from ..roles import label_for

router = APIRouter(prefix="/chat", tags=["chat"])


def _msg(m):
    return {"id": m.id, "sender_id": m.sender_id, "body": m.body, "created_at": m.created_at.isoformat()}


@router.get("/users")
def people(user=Depends(clinic_member), db: Session = Depends(get_db)):
    """Everyone else at this clinic, with how many of their messages I have not read."""
    out = []
    for u in db.query(User).filter(User.clinic_id == user.clinic_id, User.id != user.id, User.is_active.is_(True)).order_by(User.full_name):
        unread = db.query(ChatMessage).filter(ChatMessage.sender_id == u.id, ChatMessage.recipient_id == user.id, ChatMessage.read_at.is_(None)).count()
        out.append({"id": u.id, "full_name": u.full_name, "role_label": label_for(u.role, user.clinic.clinic_class), "avatar": u.avatar, "unread": unread})
    return out


def _other(db, user, uid):
    o = db.query(User).filter(User.id == uid, User.clinic_id == user.clinic_id).first()
    if not o:
        raise HTTPException(404, "Person not found.")
    return o


@router.get("/with/{uid}")
def thread(uid: int, user=Depends(clinic_member), db: Session = Depends(get_db)):
    _other(db, user, uid)
    q = db.query(ChatMessage).filter(ChatMessage.clinic_id == user.clinic_id,
                                     or_((ChatMessage.sender_id == user.id) & (ChatMessage.recipient_id == uid), (ChatMessage.sender_id == uid) & (ChatMessage.recipient_id == user.id)))
    rows = q.order_by(ChatMessage.id.desc()).limit(200).all()[::-1]
    for m in rows:
        if m.recipient_id == user.id and not m.read_at:
            m.read_at = datetime.utcnow()
    db.commit()
    return [_msg(m) for m in rows]


@router.post("/with/{uid}", status_code=201)
def send(uid: int, payload: dict = Body(...), user=Depends(clinic_member), db: Session = Depends(get_db)):
    _other(db, user, uid)
    body = (payload.get("body") or "").strip()
    if not body:
        raise HTTPException(422, "Write a message first.")
    m = ChatMessage(clinic_id=user.clinic_id, sender_id=user.id, recipient_id=uid, body=body[:2000])
    db.add(m)
    db.commit()
    return _msg(m)


@router.get("/unread")
def unread(user=Depends(clinic_member), db: Session = Depends(get_db)):
    return {"count": db.query(ChatMessage).filter(ChatMessage.recipient_id == user.id, ChatMessage.read_at.is_(None)).count()}


SYSTEM = ("You are an assistant for staff at a clinic or pharmacy. Help with clinical questions, drug information, documentation and the "
          "day-to-day running of the clinic. You support the staff's own judgement and never replace it: for any diagnosis or treatment "
          "decision, remind them to rely on their own clinical judgement and local guidelines. Keep answers short and practical.")


@router.post("/ai")
def ask_ai(payload: dict = Body(...), user=Depends(clinic_member)):
    """The AI consultation page. The conversation so far is sent each time; nothing is stored."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "The AI assistant is not set up yet. The system administrator must add ANTHROPIC_API_KEY on the server.")
    turns = [{"role": m["role"], "content": str(m["content"])[:4000]} for m in (payload.get("messages") or [])[-20:] if m.get("role") in ("user", "assistant") and m.get("content")]
    if not turns or turns[-1]["role"] != "user":
        raise HTTPException(422, "Ask a question first.")
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=60,
                       headers={"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                       json={"model": settings.AI_MODEL, "max_tokens": 1000, "system": SYSTEM, "messages": turns})
    except Exception:
        raise HTTPException(502, "The AI assistant could not be reached. Try again in a moment.")
    if r.status_code != 200:
        raise HTTPException(502, "The AI assistant is not available right now.")
    text = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text")
    return {"reply": text or "I could not think of an answer. Please rephrase the question."}
