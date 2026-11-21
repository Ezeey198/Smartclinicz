from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import module_guard
from .. import stockkeeping as sk
from ..models import InventoryItem
from ..wallet import wallet_post
from .records import ser

router = APIRouter(prefix="/inventory", tags=["inventory"])


class ReceiveIn(BaseModel):
    quantity: float = Field(gt=0)
    cost: float = Field(default=0, ge=0)
    pay_from_wallet: bool = False


@router.post("/{iid}/receive")
def receive(iid: int, body: ReceiveIn, user=Depends(module_guard("inventory", write=True)), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == iid, InventoryItem.clinic_id == user.clinic_id).first()
    if not item:
        raise HTTPException(404, "Stock item not found.")
    sk.ensure_identity(db, user, item)
    unit_price = round(body.cost / body.quantity, 4) if body.cost else 0
    batch = sk.new_batch(db, user, item, batch_no=None, qty=body.quantity, purchase_price=unit_price)       # same record as the Stock page, with its own Stock ID
    paid = body.cost > 0 and body.pay_from_wallet
    if paid:
        wallet_post(db, user.clinic, user, "stock_purchase", -body.cost, method="wallet",
                    description=f"Stock: {body.quantity:g} {item.unit or ''} {item.name} ({batch.stock_no})".replace("  ", " "))
    log(db, user, "inventory", "received", f"{user.full_name} received {body.quantity:g} {item.unit or 'units'} of {item.name}",
        {"cost": body.cost, "paid_from_wallet": paid, "stock_after": item.quantity})
    db.commit()
    return ser(item)
