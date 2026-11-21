from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import payments
from ..config import settings
from ..database import get_db
from ..deps import clinic_admin_only
from ..models import SubscriptionPayment
from ..subscriptions import iso, renew, sub_state
from .records import ser

router = APIRouter(prefix="/subscription", tags=["subscription"])


def _view(db, user):
    c = user.clinic
    hist = db.query(SubscriptionPayment).filter(SubscriptionPayment.clinic_id == c.id).order_by(SubscriptionPayment.id.desc()).limit(50).all()
    return {**sub_state(c), "wallet_balance": c.wallet_balance or 0,
            "history": [{**ser(p), "period_start": iso(p.period_start), "period_end": iso(p.period_end), "created_at": iso(p.created_at)} for p in hist]}


@router.get("")
def get_subscription(user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    return _view(db, user)


class PayIn(BaseModel):
    method: str
    network: str | None = None
    phone: str | None = None


@router.post("/pay")
def pay(body: PayIn, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    c, price = user.clinic, settings.SUBSCRIPTION_PRICE
    if body.method == "wallet":
        renew(db, c, user)
    elif body.method in ("mobile_money", "card"):
        if payments.live():
            if body.method != "mobile_money":
                raise HTTPException(422, "Card payments are not available yet. Use mobile money.")
            req = payments.start(db, c, user, body.network, body.phone, price, "subscription")
            return {"status": "pending", "request_id": req.id}
        ref = payments.simulated_topup(db, c, user, price, body.method, body.phone)
        renew(db, c, user, method=body.method, ref=ref)
    else:
        raise HTTPException(422, "Choose how to pay.")
    return {**_view(db, user), "status": "successful"}
