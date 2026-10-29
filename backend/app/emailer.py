import smtplib
from email.message import EmailMessage
from sqlalchemy.orm import Session
from .config import settings
from .models import EmailOutbox, Clinic, User
from .roles import ROLE_LABELS, CLASS_NAMES


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST)


def _html(title, lines, button, link):
    body = "".join(f'<p style="color:#33475b;line-height:1.55">{l}</p>' for l in lines)
    return (f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;'
            f'border:1px solid #dbe5e7;border-radius:10px"><h2 style="color:#12263a;margin-top:0">{title}</h2>{body}'
            f'<p><a href="{link}" style="background:#0e7c86;color:#fff;padding:12px 22px;border-radius:8px;'
            f'text-decoration:none;display:inline-block">{button}</a></p>'
            f'<p style="color:#7a8a99;font-size:12px">Button not working? Copy this link into your browser: {link}</p></div>')


def _send(msg: EmailMessage):
    if settings.SMTP_SECURITY == "ssl":
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    with server as s:
        if settings.SMTP_SECURITY == "starttls":
            s.starttls()
        if settings.SMTP_USER:
            s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        s.send_message(msg)


def deliver(db: Session, to: str, subject: str, title: str, lines: list[str], button: str, link: str) -> dict:
    """Stores the email in the outbox, tries to send it, and reports what happened."""
    text = f"{title}\n\n" + "\n".join(lines) + f"\n\n{button}: {link}"
    rec = EmailOutbox(to_email=to, subject=subject, body_text=text)
    if smtp_configured():
        try:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = settings.SMTP_FROM, to, subject
            msg.set_content(text)
            msg.add_alternative(_html(title, lines, button, link), subtype="html")
            _send(msg)
            rec.sent = True
        except Exception as e:
            rec.error = f"{type(e).__name__}: {e}"
            print(f"\n[email FAILED -> {to}] {rec.error}\n{link}\n")
    else:
        print(f"\n[email stored, SMTP not set up -> {to}] {subject}\n{link}\n")
    db.add(rec)
    db.commit()
    return {"to": to, "subject": subject, "sent": bool(rec.sent), "error": rec.error, "link": link}


def send_clinic_approval(db: Session, clinic: Clinic, admin: User) -> dict:
    link = f"{settings.FRONTEND_URL}/approve-clinic?token={clinic.approval_token}"
    return deliver(db, admin.email, f"Approve your clinic: {clinic.name}", "Approve your clinic",
                   [f"Hello {admin.full_name},",
                    f"<b>{clinic.name}</b> has been registered on ClinicPro as <b>{CLASS_NAMES[clinic.clinic_class]}</b>.",
                    f"Your clinic code is <b>{clinic.code}</b>. You will need it every time you sign in.",
                    "Review the details and approve the clinic to switch it on."],
                   "Approve clinic", link)


def send_account_activation(db: Session, user: User, clinic: Clinic) -> dict:
    link = f"{settings.FRONTEND_URL}/activate?token={user.activation_token}"
    reset = bool(user.password_hash)
    return deliver(db, user.email,
                   "Set a new password" if reset else f"Activate your account at {clinic.name}",
                   "Set a new password" if reset else "Activate your account",
                   [f"Hello {user.full_name},",
                    f"Your role at <b>{clinic.name}</b>: <b>{ROLE_LABELS.get(user.role, user.role)}</b>.",
                    f"Clinic code: <b>{clinic.code}</b> (keep it, you sign in with it).",
                    "Choose a password to " + ("regain access." if reset else "activate your account. Your account stays inactive until you do.")],
                   "Set password" if reset else "Activate account", link)
