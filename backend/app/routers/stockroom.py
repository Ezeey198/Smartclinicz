"""The clinic's stock records: every medicine/item with an automatic Medicine ID, received in batches that each have an automatic Stock ID,
quantities received and available, purchase and selling prices, expiry, supplier and location, and the history of every adjustment."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .. import stockkeeping as sk
from ..activity import log
from ..database import get_db
from ..deps import module_guard
from ..models import InventoryBatch, InventoryItem, StockAdjustment
from ..wallet import wallet_post

router = APIRouter(prefix="/stockroom", tags=["stock"])
read = module_guard("inventory")
write = module_guard("inventory", write=True)
SOON_DAYS = 30


def _batch(b):
    return {"id": b.id, "stock_no": b.stock_no, "batch_no": b.batch_no, "qty_received": b.qty_received, "qty_available": b.qty_available, "purchase_price": b.purchase_price,
            "selling_price": b.selling_price, "expiry_date": b.expiry_date, "supplier": b.supplier, "location": b.location, "received_at": b.created_at.isoformat()}


def _item(it, batches):
    live = [b for b in batches if (b.qty_available or 0) > 0]
    return {"id": it.id, "medicine_code": it.medicine_code, "name": it.name, "category": it.category, "unit": it.unit, "reorder_level": it.reorder_level,
            "quantity": it.quantity or 0, "expiry_date": it.expiry_date, "supplier": it.supplier,
            "locations": sorted({b.location for b in live if b.location}), "batches": [_batch(b) for b in batches]}


def _get_item(db, user, iid) -> InventoryItem:
    it = db.query(InventoryItem).filter(InventoryItem.id == iid, InventoryItem.clinic_id == user.clinic_id).first()
    if not it:
        raise HTTPException(404, "Item not found.")
    return it


@router.get("")
def stock(user=Depends(read), db: Session = Depends(get_db)):
    """Every item with its batches. Older items get their Medicine ID and an opening batch the first time this is opened."""
    items = db.query(InventoryItem).filter(InventoryItem.clinic_id == user.clinic_id).order_by(InventoryItem.name).all()
    have = {r[0] for r in db.query(InventoryBatch.item_id).filter(InventoryBatch.clinic_id == user.clinic_id)}
    if any(not i.medicine_code or ((i.quantity or 0) > 0 and i.id not in have) for i in items):
        for i in items:
            sk.ensure_identity(db, user, i)
        db.commit()
    batches = db.query(InventoryBatch).filter(InventoryBatch.clinic_id == user.clinic_id).order_by(InventoryBatch.id).all()
    by = {}
    for b in batches:
        by.setdefault(b.item_id, []).append(b)
    suppliers = sorted({b.supplier for b in batches if b.supplier})
    locations = sorted({b.location for b in batches if b.location})
    return {"items": [_item(i, by.get(i.id, [])) for i in items], "suppliers": suppliers, "locations": locations, "soon_days": SOON_DAYS}


class BatchIn(BaseModel):
    batch_no: str | None = None
    quantity: float = Field(gt=0)
    purchase_price: float = Field(default=0, ge=0)
    selling_price: float = Field(default=0, ge=0)
    expiry_date: str | None = None
    supplier: str | None = None
    location: str | None = None


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    unit: str | None = None
    reorder_level: float | None = Field(default=None, ge=0)
    first_batch: BatchIn | None = None


def _check_date(d):
    if d:
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(422, "The expiry date must be a real date.")


@router.post("/items", status_code=201)
def new_item(body: ItemIn, user=Depends(write), db: Session = Depends(get_db)):
    """A new medicine or item. The Medicine ID is made automatically; the first batch (opening stock) is optional."""
    name = body.name.strip()
    if db.query(InventoryItem.id).filter(InventoryItem.clinic_id == user.clinic_id, InventoryItem.name.ilike(name)).first():
        raise HTTPException(409, f"{name} is already in stock. Use Add stock to put more onto it.")
    it = InventoryItem(clinic_id=user.clinic_id, name=name, category=body.category, unit=body.unit, reorder_level=body.reorder_level, quantity=0,
                       medicine_code=sk.next_code(db, InventoryItem, InventoryItem.medicine_code, user.clinic_id, "MED"))
    db.add(it)
    db.flush()
    b = body.first_batch
    if b:
        _check_date(b.expiry_date)
        sk.new_batch(db, user, it, batch_no=b.batch_no, qty=b.quantity, purchase_price=b.purchase_price, selling_price=b.selling_price, expiry_date=b.expiry_date,
                     supplier=b.supplier, location=b.location, kind="opening", reason="Opening stock")
    log(db, user, "inventory", "created", f"{user.full_name} added {it.name} ({it.medicine_code}) to stock", {"medicine_id": it.medicine_code})
    db.commit()
    return _item(it, db.query(InventoryBatch).filter(InventoryBatch.item_id == it.id).all())


@router.patch("/items/{iid}")
def edit_item(iid: int, payload: dict = Body(...), user=Depends(write), db: Session = Depends(get_db)):
    it = _get_item(db, user, iid)
    for k in ("name", "category", "unit"):
        if k in payload and (payload[k] or "").strip():
            setattr(it, k, payload[k].strip())
    if "reorder_level" in payload:
        v = payload["reorder_level"]
        it.reorder_level = None if v in (None, "") else max(0.0, float(v))
    db.commit()
    return _item(it, db.query(InventoryBatch).filter(InventoryBatch.item_id == it.id).all())


class ReceiveIn(BatchIn):
    batch_id: int | None = None          # set: add this quantity onto that existing batch. Empty: a new batch with its own Stock ID.
    pay_from_wallet: bool = False


@router.post("/items/{iid}/stock", status_code=201)
def add_stock(iid: int, body: ReceiveIn, user=Depends(write), db: Session = Depends(get_db)):
    """Adds stock to an item that already exists: as a new batch, or onto one of its existing batches."""
    it = _get_item(db, user, iid)
    _check_date(body.expiry_date)
    if body.batch_id:
        b = db.query(InventoryBatch).filter(InventoryBatch.id == body.batch_id, InventoryBatch.item_id == it.id).first()
        if not b:
            raise HTTPException(404, "That batch was not found.")
        before = b.qty_available or 0
        b.qty_received = (b.qty_received or 0) + body.quantity
        b.qty_available = before + body.quantity
        for k in ("purchase_price", "selling_price"):                  # a price typed now updates the batch
            if getattr(body, k):
                setattr(b, k, getattr(body, k))
        for k in ("expiry_date", "supplier", "location"):
            if (getattr(body, k) or "").strip():
                setattr(b, k, getattr(body, k).strip())
        sk.record(db, user, it, b, "received", body.quantity, before, b.qty_available, f"Added to existing batch {b.batch_no or b.stock_no}")
        sk.sync_item(db, it)
    else:
        no = (body.batch_no or "").strip()
        if no and db.query(InventoryBatch.id).filter(InventoryBatch.item_id == it.id, InventoryBatch.batch_no == no).first():
            raise HTTPException(409, f"Batch {no} already exists for {it.name}. Choose it under “Add to an existing batch”.")
        b = sk.new_batch(db, user, it, batch_no=no, qty=body.quantity, purchase_price=body.purchase_price, selling_price=body.selling_price, expiry_date=body.expiry_date,
                         supplier=body.supplier, location=body.location)
    cost = round(body.quantity * (body.purchase_price or 0), 2)
    paid = body.pay_from_wallet and cost > 0
    if paid:
        wallet_post(db, user.clinic, user, "stock_purchase", -cost, method="wallet", description=f"Stock: {body.quantity:g} {it.unit or ''} {it.name} ({b.stock_no})".replace("  ", " "))
    log(db, user, "inventory", "received", f"{user.full_name} received {body.quantity:g} {it.unit or 'units'} of {it.name} ({b.stock_no})",
        {"stock_id": b.stock_no, "cost": cost, "paid_from_wallet": paid, "stock_after": it.quantity})
    db.commit()
    return _item(it, db.query(InventoryBatch).filter(InventoryBatch.item_id == it.id).all())


class AdjustIn(BaseModel):
    new_available: float | None = Field(default=None, ge=0)      # set the available quantity to this (a stock count), or
    change: float | None = None                                  # add (+) or remove (-) this much
    kind: str = "correction"
    reason: str = Field(min_length=3, max_length=300)


@router.post("/batches/{bid}/adjust")
def adjust(bid: int, body: AdjustIn, user=Depends(write), db: Session = Depends(get_db)):
    """A manual adjustment to one batch (count, correction, damaged, expired, lost, returned). A reason is always required and everything is kept in the history."""
    b = db.query(InventoryBatch).filter(InventoryBatch.id == bid, InventoryBatch.clinic_id == user.clinic_id).first()
    if not b:
        raise HTTPException(404, "Batch not found.")
    it = db.get(InventoryItem, b.item_id)
    if body.kind not in sk.KINDS or body.kind in ("dispensed", "opening", "edited"):
        raise HTTPException(422, "Choose what kind of adjustment this is.")
    if (body.new_available is None) == (body.change is None):
        raise HTTPException(422, "Give either the new quantity or the amount to add or remove.")
    before = b.qty_available or 0
    after = body.new_available if body.new_available is not None else before + body.change
    if body.new_available is None and body.kind in sk.KINDS_OUT and body.change > 0:
        after = before - body.change                                # "damaged 5" means remove 5
    if after < -1e-9:
        raise HTTPException(400, f"Only {before:g} are available in this batch, so that much cannot be removed.")
    after = round(max(after, 0), 4)
    b.qty_available = after
    if after > (b.qty_received or 0):
        b.qty_received = after                                      # received can never be less than what is on the shelf
    sk.record(db, user, it, b, body.kind, after - before, before, after, body.reason)
    sk.sync_item(db, it)
    log(db, user, "inventory", "adjusted", f"{user.full_name} adjusted {it.name} ({b.stock_no}) from {before:g} to {after:g}: {body.reason}", {"kind": body.kind, "stock_id": b.stock_no})
    db.commit()
    return _item(it, db.query(InventoryBatch).filter(InventoryBatch.item_id == it.id).all())


@router.patch("/batches/{bid}")
def edit_batch(bid: int, payload: dict = Body(...), user=Depends(write), db: Session = Depends(get_db)):
    """Corrects a batch's details (batch number, prices, expiry, supplier, location). The quantity is changed only through an adjustment."""
    b = db.query(InventoryBatch).filter(InventoryBatch.id == bid, InventoryBatch.clinic_id == user.clinic_id).first()
    if not b:
        raise HTTPException(404, "Batch not found.")
    it = db.get(InventoryItem, b.item_id)
    changed = []
    for k in ("batch_no", "expiry_date", "supplier", "location"):
        if k in payload and (payload[k] or "").strip() != (getattr(b, k) or ""):
            if k == "expiry_date":
                _check_date(payload[k])
            changed.append(f"{k.replace('_', ' ')}: {getattr(b, k) or '-'} -> {(payload[k] or '').strip() or '-'}")
            setattr(b, k, (payload[k] or "").strip() or None)
    for k in ("purchase_price", "selling_price"):
        if k in payload and payload[k] not in (None, "") and float(payload[k]) != (getattr(b, k) or 0):
            changed.append(f"{k.replace('_', ' ')}: {getattr(b, k) or 0:g} -> {float(payload[k]):g}")
            setattr(b, k, max(0.0, float(payload[k])))
    if changed:
        sk.record(db, user, it, b, "edited", 0, b.qty_available or 0, b.qty_available or 0, "; ".join(changed))
        sk.sync_item(db, it)
    db.commit()
    return _item(it, db.query(InventoryBatch).filter(InventoryBatch.item_id == it.id).all())


@router.get("/history")
def history(item_id: int | None = None, limit: int = 200, user=Depends(read), db: Session = Depends(get_db)):
    """The stock adjustment history, newest first: for one item, or for everything."""
    q = db.query(StockAdjustment).filter(StockAdjustment.clinic_id == user.clinic_id)
    if item_id:
        q = q.filter(StockAdjustment.item_id == item_id)
    rows = q.order_by(StockAdjustment.id.desc()).limit(min(max(limit, 1), 500)).all()
    names = {i.id: (i.name, i.medicine_code) for i in db.query(InventoryItem).filter(InventoryItem.clinic_id == user.clinic_id)}
    return [{"id": a.id, "created_at": a.created_at.isoformat(), "item": names.get(a.item_id, ("", ""))[0], "medicine_code": names.get(a.item_id, ("", ""))[1], "stock_no": a.stock_no,
             "kind": a.kind, "change": a.change, "before": a.before, "after": a.after, "reason": a.reason, "user_name": a.user_name} for a in rows]
