from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import clinic_member
from ..models import PaymentRequest, WalletTx
from .. import payments
from ..roles import MONEY_ROLES, TOPUP_ROLES
from ..wallet import wallet_post
from .records import ser

router = APIRouter(prefix="/wallet", tags=["wallet"])


def _sum(db, cid, *f):
    return float(db.query(func.coalesce(func.sum(WalletTx.amount), 0)).filter(WalletTx.clinic_id == cid, *f).scalar() or 0)


@router.get("/summary")
def summary(user=Depends(clinic_member), db: Session = Depends(get_db)):
    cid, see = user.clinic_id, user.role in MONEY_ROLES
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    mine = WalletTx.user_id == user.id
    out = {"can_see_balance": see, "can_topup": user.role in TOPUP_ROLES, "balance": (user.clinic.wallet_balance or 0) if see else None,
           "mine_in": _sum(db, cid, mine, WalletTx.amount > 0), "mine_out": -_sum(db, cid, mine, WalletTx.amount < 0),
           "mine_count": db.query(WalletTx).filter(WalletTx.clinic_id == cid, mine).count()}
    if see:
        out["today_in"] = _sum(db, cid, WalletTx.amount > 0, WalletTx.created_at >= start)
        out["today_out"] = -_sum(db, cid, WalletTx.amount < 0, WalletTx.created_at >= start)
    return out


@router.get("/transactions")
def transactions(scope: str = "mine", user=Depends(clinic_member), db: Session = Depends(get_db)):
    see = user.role in MONEY_ROLES
    q = db.query(WalletTx).filter(WalletTx.clinic_id == user.clinic_id)
    if scope != "all" or not see:
        q = q.filter(WalletTx.user_id == user.id)
    rows = [ser(t) for t in q.order_by(WalletTx.id.desc()).limit(300)]
    if not see:
        for r in rows:
            r["balance_after"] = None
    return rows


@router.get("/options")
def options(user=Depends(clinic_member)):
    return payments.options()


class TopUp(BaseModel):
    amount: float = Field(gt=0, le=50_000_000)
    method: str = "mobile_money"
    network: str | None = None
    phone: str | None = None


@router.post("/topup")
def topup(body: TopUp, user=Depends(clinic_member), db: Session = Depends(get_db)):
    if user.role not in TOPUP_ROLES:
        raise HTTPException(403, "Only the clinic admin or accountant can top up the wallet.")
    if body.method not in ("mobile_money", "card"):
        raise HTTPException(422, "Choose mobile money or card.")
    if payments.live():
        if body.method != "mobile_money":
            raise HTTPException(422, "Card payments are not available yet. Use mobile money.")
        req = payments.start(db, user.clinic, user, body.network, body.phone, body.amount, "topup")
        return {"status": "pending", "request_id": req.id}
    ref = payments.simulated_topup(db, user.clinic, user, body.amount, body.method, body.phone)
    log(db, user, "wallet", "topup", f"{user.full_name} topped up the clinic wallet by UGX {body.amount:,.0f} (demo payment)", {"method": body.method, "reference": ref})
    db.commit()
    return {"status": "successful", "balance": user.clinic.wallet_balance, "reference": ref}


@router.get("/payments/{pid}")
def payment_status(pid: int, user=Depends(clinic_member), db: Session = Depends(get_db)):
    """The page polls this while the customer approves the payment on their phone."""
    if user.role not in TOPUP_ROLES:
        raise HTTPException(403, "Not allowed.")
    req = db.query(PaymentRequest).filter(PaymentRequest.id == pid, PaymentRequest.clinic_id == user.clinic_id).first()
    if not req:
        raise HTTPException(404, "Payment not found.")
    payments.settle(db, req)
    return {"id": req.id, "status": req.status, "reason": req.reason, "amount": req.amount, "purpose": req.purpose, "provider": req.provider}
