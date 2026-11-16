"""Stock keeping for the clinic's inventory: automatic Stock IDs and Medicine IDs, batches, first-expiry-first-out dispensing, and the
history of every adjustment."""
from datetime import datetime
from sqlalchemy import func
from .models import InventoryBatch, InventoryItem, StockAdjustment

KINDS_OUT = ("damaged", "expired", "lost", "returned_to_supplier")    # take stock away
KINDS = ("received", "dispensed", "correction", "count", "damaged", "expired", "lost", "returned_to_supplier", "returned_by_patient", "edited", "opening")


def next_number(top, prefix) -> str:
    """'STK-000041' -> 'STK-000042'. The first one is 'STK-000001'."""
    n = int(top.split("-")[1]) + 1 if top else 1
    return f"{prefix}-{n:06d}"


def next_code(db, model, column, clinic_id, prefix) -> str:
    """The next automatic ID for this clinic (each clinic counts from 1)."""
    top = db.query(func.max(column)).filter(model.clinic_id == clinic_id).scalar()
    return next_number(top, prefix)


def plan_take(batches, qty, today):
    """First expiry, first out. `batches` are (id, available, expiry) triples. Expired batches are never sold, and a batch with no
    expiry date goes last. Returns [(id, amount)], or None when there is not enough stock that is still good."""
    good = [b for b in batches if b[1] > 0 and (not b[2] or b[2] >= today)]
    if sum(b[1] for b in good) + 1e-9 < qty:
        return None
    out, left = [], qty
    for bid, avail, _exp in sorted(good, key=lambda b: (b[2] is None or b[2] == "", b[2] or "", b[0])):
        if left <= 1e-9:
            break
        take = min(avail, left)
        out.append((bid, take))
        left -= take
    return out


def record(db, user, item, batch, kind, change, before, after, reason):
    db.add(StockAdjustment(clinic_id=item.clinic_id, item_id=item.id, batch_id=batch.id if batch else None, stock_no=batch.stock_no if batch else None,
                           kind=kind, change=round(change, 4), before=round(before, 4), after=round(after, 4), reason=(reason or "")[:300], user_name=user.full_name))


def sync_item(db, item):
    """Keeps the item's total, nearest expiry and latest supplier in step with its batches (the rest of the system reads these)."""
    db.flush()
    rows = db.query(InventoryBatch).filter(InventoryBatch.item_id == item.id).order_by(InventoryBatch.id).all()
    item.quantity = round(sum(b.qty_available or 0 for b in rows), 4)
    live = [b.expiry_date for b in rows if (b.qty_available or 0) > 0 and b.expiry_date]
    item.expiry_date = min(live) if live else None
    sup = [b.supplier for b in rows if b.supplier]
    if sup:
        item.supplier = sup[-1]


def new_batch(db, user, item, *, batch_no, qty, purchase_price=0, selling_price=0, expiry_date=None, supplier=None, location=None, kind="received", reason="Stock received"):
    b = InventoryBatch(clinic_id=item.clinic_id, item_id=item.id, stock_no=next_code(db, InventoryBatch, InventoryBatch.stock_no, item.clinic_id, "STK"),
                       batch_no=(batch_no or "").strip() or None, qty_received=qty, qty_available=qty, purchase_price=purchase_price or 0, selling_price=selling_price or 0,
                       expiry_date=(expiry_date or "").strip() or None, supplier=(supplier or "").strip() or None, location=(location or "").strip() or None)
    db.add(b)
    db.flush()
    record(db, user, item, b, kind, qty, 0, qty, reason)
    sync_item(db, item)
    return b


def take(db, user, item, qty, reason):
    """Dispenses from the oldest good batches. Returns {'price': selling price of the first batch used, 'used': [...]} or None if there is not enough."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    batches = db.query(InventoryBatch).filter(InventoryBatch.item_id == item.id, InventoryBatch.qty_available > 0).all()
    plan = plan_take([(b.id, b.qty_available, b.expiry_date) for b in batches], qty, today)
    if plan is None:
        return None
    by_id = {b.id: b for b in batches}
    used = []
    for bid, amount in plan:
        b = by_id[bid]
        before = b.qty_available
        b.qty_available = round(before - amount, 4)
        record(db, user, item, b, "dispensed", -amount, before, b.qty_available, reason)
        used.append({"stock_no": b.stock_no, "batch_no": b.batch_no, "quantity": amount, "selling_price": b.selling_price})
    sync_item(db, item)
    return {"price": used[0]["selling_price"] if used else 0, "used": used}


def next_batch_price(db, item):
    """The selling price of the batch that would be dispensed next (oldest good stock), or 0."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    rows = db.query(InventoryBatch).filter(InventoryBatch.item_id == item.id, InventoryBatch.qty_available > 0).all()
    plan = plan_take([(b.id, b.qty_available, b.expiry_date) for b in rows], min(1, sum(b.qty_available for b in rows) or 1), today)
    if not plan:
        return 0
    return next((b.selling_price for b in rows if b.id == plan[0][0]), 0) or 0


def ensure_identity(db, user, item):
    """Gives an older item its Medicine ID, and turns any old single quantity into an opening batch so nothing is lost."""
    if not item.medicine_code:
        item.medicine_code = next_code(db, InventoryItem, InventoryItem.medicine_code, item.clinic_id, "MED")
        db.flush()
    has = db.query(InventoryBatch.id).filter(InventoryBatch.item_id == item.id).first()
    if not has and (item.quantity or 0) > 0:
        new_batch(db, user, item, batch_no="OPENING", qty=item.quantity, expiry_date=item.expiry_date, supplier=item.supplier, kind="opening", reason="Opening balance (stock recorded before batches)")
