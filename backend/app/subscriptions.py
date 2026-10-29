from datetime import datetime, timedelta
from fastapi import HTTPException
from .activity import log
from .config import settings
from .models import SubscriptionPayment
from .wallet import wallet_post


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def sub_state(clinic) -> dict:
    now = datetime.utcnow()
    if clinic.status == "pending":
        state = "pending"
    elif clinic.status == "suspended":
        state = "suspended"
    elif clinic.active_until and clinic.active_until > now:
        state = "active"
    else:
        state = "expired"
    left = int((clinic.active_until - now).total_seconds()) if state == "active" else 0
    return {"state": state, "active_until": iso(clinic.active_until), "seconds_left": max(left, 0), "trial": not clinic.has_paid,
            "price": settings.SUBSCRIPTION_PRICE, "period_hours": settings.SUBSCRIPTION_HOURS, "trial_hours": settings.TRIAL_HOURS}


def is_expired(clinic) -> bool:
    return sub_state(clinic)["state"] == "expired"


def renew(db, clinic, user, method="wallet", ref=None):
    """Pays the subscription price out of the clinic wallet and extends the active period."""
    price = settings.SUBSCRIPTION_PRICE
    if (clinic.wallet_balance or 0) < price:
        raise HTTPException(400, f"The clinic wallet has UGX {clinic.wallet_balance or 0:,.0f} and UGX {price:,.0f} is needed. Top it up or pay with mobile money.")
    wallet_post(db, clinic, user, "subscription", -price, method="wallet", reference=ref,
                description=f"Subscription for {settings.SUBSCRIPTION_HOURS} hours")
    now = datetime.utcnow()
    start = max(now, clinic.active_until or now)
    end = start + timedelta(hours=settings.SUBSCRIPTION_HOURS)
    clinic.active_until, clinic.has_paid = end, True
    db.add(SubscriptionPayment(clinic_id=clinic.id, amount=price, method=method, reference=ref, paid_by=user.full_name, period_start=start, period_end=end))
    log(db, user, "subscription", "paid", f"{user.full_name} paid the clinic subscription (UGX {price:,.0f})",
        {"method": method, "reference": ref, "active_until": iso(end)})
    db.commit()
