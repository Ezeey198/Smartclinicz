"""Provider callbacks. The body is never trusted: it only tells us which payment to re-check with the provider."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from .. import payments
from ..database import get_db
from ..models import PaymentRequest

router = APIRouter(prefix="/payments", tags=["payments"])


@router.api_route("/callback/{provider}", methods=["POST", "PUT"])
async def callback(provider: str, request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        body = {}
    ref = body.get("externalId") or (body.get("transaction") or {}).get("id")
    req = ref and db.query(PaymentRequest).filter(PaymentRequest.reference == str(ref)).first()
    if req and req.provider == provider:
        try:
            payments.settle(db, req)
        except Exception:
            pass   # the page's own polling will settle it
    return {"ok": True}
