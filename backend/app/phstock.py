"""Stock keeping for the standalone pharmacy: automatic Stock IDs and medicine codes, the oldest-expiry-first rule, and the stock movement register.
Every change to stock is written to the movement register (the stock card), using the same StockAdjustment table the clinic stock uses."""
from datetime import datetime
from .models import Product, StockAdjustment, StockBatch
from .stockkeeping import next_code


def today():
    return datetime.utcnow().strftime("%Y-%m-%d")


def move(db, user, product, batch, kind, change, before, after, reason):
    """One line in the stock movement register: received, sold, adjusted, damaged, expired, returned, transferred, quarantined, recalled..."""
    db.add(StockAdjustment(clinic_id=product.clinic_id, item_id=product.id, batch_id=batch.id if batch else None, stock_no=batch.stock_no if batch else None, kind=kind,
                           change=round(change, 4), before=round(before, 4), after=round(after, 4), reason=(reason or "")[:300], user_name=user.full_name))


def new_stock_no(db, clinic_id):
    return next_code(db, StockBatch, StockBatch.stock_no, clinic_id, "STK")


def new_med_code(db, clinic_id):
    return next_code(db, Product, Product.medicine_code, clinic_id, "MED")


def usable_batches(db, clinic_id, product_id):
    """Batches that may be sold: in stock, not expired, and not quarantined or recalled. Oldest expiry first; no expiry date goes last."""
    t = today()
    rows = db.query(StockBatch).filter(StockBatch.clinic_id == clinic_id, StockBatch.product_id == product_id, StockBatch.quantity > 0).all()
    ok = [b for b in rows if (b.status or "usable") == "usable" and (not b.expiry_date or b.expiry_date >= t)]
    return sorted(ok, key=lambda b: (not b.expiry_date, b.expiry_date or "", b.id))


def usable_total(db, clinic_id, product_id):
    return sum(b.quantity for b in usable_batches(db, clinic_id, product_id))


def give_identity(db, batch):
    """A batch made before Stock IDs existed gets one, and its received quantity."""
    if not batch.stock_no:
        batch.stock_no = new_stock_no(db, batch.clinic_id)
        db.flush()
    if not batch.qty_received:
        batch.qty_received = batch.quantity or 0
