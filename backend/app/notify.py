"""Notifications. Every notification is stored for the system page (the bell) AND sent by SMS to the person's phone.
SMS goes out through Africa's Talking when AT_USERNAME / AT_API_KEY are set; otherwise the text waits in the SMS outbox."""
import re
import threading
import httpx
from .config import settings
from .database import SessionLocal
from .models import Notification, SmsOutbox, User

MAX_TRIES = 3


def _phone(raw):
    d = re.sub(r"[^\d+]", "", raw or "")
    if not d:
        return None
    if d.startswith("+"):
        return d
    cc = settings.PHONE_COUNTRY_CODE
    d = d[2:] if d.startswith("00") else d
    if d.startswith(cc):
        return "+" + d
    return "+" + cc + d.lstrip("0")


def sms(db, phone, text, clinic_id=None):
    """Queues one SMS. It is sent by flush_sms() right after the request, and retried later if it fails."""
    to = _phone(phone)
    if to:
        db.add(SmsOutbox(clinic_id=clinic_id, to_phone=to, body=text[:480]))


def _send_one(row) -> str | None:
    """Returns an error text, or None when the SMS was sent."""
    if not (settings.AT_USERNAME and settings.AT_API_KEY):
        return "SMS is not set up (AT_USERNAME / AT_API_KEY)."
    url = "https://api.sandbox.africastalking.com/version1/messaging" if settings.AT_USERNAME == "sandbox" else "https://api.africastalking.com/version1/messaging"
    data = {"username": settings.AT_USERNAME, "to": row.to_phone, "message": row.body}
    if settings.AT_SENDER:
        data["from"] = settings.AT_SENDER
    try:
        r = httpx.post(url, data=data, headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"}, timeout=10)
        return None if r.status_code in (200, 201) else f"SMS provider answered {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def _flush():
    with SessionLocal() as db:
        for row in db.query(SmsOutbox).filter(SmsOutbox.sent.is_(False), SmsOutbox.tries < MAX_TRIES).order_by(SmsOutbox.id).limit(30).all():
            err = _send_one(row)
            row.tries = (row.tries or 0) + 1
            row.sent, row.error = err is None, err
            db.commit()


def flush_sms():
    """Sends the waiting SMS in the background so the page that caused them is not slowed down."""
    if settings.AT_USERNAME and settings.AT_API_KEY:
        threading.Thread(target=_flush, daemon=True).start()


def notify(db, title, body, *, users=(), patient=None, link=None, kind="info", clinic_id=None, text_sms=True):
    """Adds a notification for each user (and/or the patient) and queues the matching SMS. The caller commits."""
    cid = clinic_id if clinic_id is not None else (patient.clinic_id if patient is not None else None)
    msg = f"{title}. {body}" if body else title
    seen = set()
    for u in users:
        if u is None or u.id in seen:
            continue
        seen.add(u.id)
        db.add(Notification(clinic_id=u.clinic_id, user_id=u.id, kind=kind, title=title[:200], body=body, link=link))
        if text_sms:
            sms(db, u.phone, msg, u.clinic_id)
    if patient is not None:
        db.add(Notification(clinic_id=patient.clinic_id, patient_id=patient.id, kind=kind, title=title[:200], body=body, link=link))
        if text_sms:
            sms(db, patient.phone, msg, patient.clinic_id)


def users_with_role(db, clinic_id, *roles):
    """Active people of the clinic who hold any of these roles (as their main role or an extra one)."""
    out = []
    for u in db.query(User).filter(User.clinic_id == clinic_id, User.is_active.is_(True)):
        if any(u.role == r for r in roles):
            out.append(u)
    return out


def notify_roles(db, clinic_id, roles, title, body, link=None, kind="info"):
    notify(db, title, body, users=users_with_role(db, clinic_id, *roles), link=link, kind=kind, clinic_id=clinic_id)


def notify_superadmins(db, title, body, link=None, kind="supervision"):
    notify(db, title, body, users=db.query(User).filter(User.is_superadmin.is_(True), User.is_active.is_(True)).all(), link=link, kind=kind)
