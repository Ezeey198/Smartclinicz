"""Stock and expiry alerts for the lab technician and the pharmacist, twice a day (08:00 and 14:00 local time).
Nothing runs in the background: the alerts are made the first time the person's page asks for notifications after each time."""
from datetime import datetime, timedelta
from .config import settings
from .models import InventoryBatch, InventoryItem, Notification
from .notify import notify

SLOTS = (8, 14)            # local hours
EXPIRY_DAYS = 30
LAB_WORDS = ("lab", "reagent", "chemical", "equipment", "consumable")


def _slot_start_utc():
    local = datetime.utcnow() + timedelta(hours=settings.TZ_OFFSET_HOURS)
    starts = [local.replace(hour=h, minute=0, second=0, microsecond=0) for h in SLOTS]
    past = [s for s in starts if s <= local]
    start = past[-1] if past else starts[-1] - timedelta(days=1)
    return start - timedelta(hours=settings.TZ_OFFSET_HOURS)


def _is_lab(item):
    return any(w in (item.category or "").lower() for w in LAB_WORDS)


def _problems(items, batches):
    """Low stock is judged per item; expiry per batch, so an old batch still on the shelf is flagged even when newer stock is fine."""
    today = datetime.utcnow().date()
    low, soon, gone = [], [], []
    for i in items:
        if i.reorder_level is not None and (i.quantity or 0) <= i.reorder_level:
            low.append(f"{i.name} ({(i.quantity or 0):g} left)")
    names = {i.id: i.name for i in items}
    for b in batches:
        if (b.qty_available or 0) <= 0 or not b.expiry_date or b.item_id not in names:
            continue
        try:
            d = datetime.strptime(b.expiry_date[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        label = f"{names[b.item_id]} {b.stock_no}"
        if d < today:
            gone.append(f"{label} (expired {d.isoformat()})")
        elif (d - today).days <= EXPIRY_DAYS:
            soon.append(f"{label} ({d.isoformat()})")
    return low, soon, gone


def twice_daily(db, user):
    wants_lab, wants_pharmacy = user.role == "lab_technician", user.role == "pharmacist"
    if not (wants_lab or wants_pharmacy) or not user.clinic_id:
        return
    start = _slot_start_utc()
    if db.query(Notification.id).filter(Notification.user_id == user.id, Notification.kind == "stock_alert", Notification.created_at >= start).first():
        return
    items = db.query(InventoryItem).filter(InventoryItem.clinic_id == user.clinic_id).all()
    mine = [i for i in items if (_is_lab(i) if wants_lab and not wants_pharmacy else not _is_lab(i) if wants_pharmacy and not wants_lab else True)]
    ids = {i.id for i in mine}
    batches = [b for b in db.query(InventoryBatch).filter(InventoryBatch.clinic_id == user.clinic_id) if b.item_id in ids]
    low, soon, gone = _problems(mine, batches)
    if not (low or soon or gone):
        return
    parts = []
    for label, rows in (("Expired", gone), ("Expiring soon", soon), ("Running low", low)):
        if rows:
            parts.append(f"{label}: " + ", ".join(rows[:4]) + (f" and {len(rows) - 4} more" if len(rows) > 4 else ""))
    notify(db, "Stock alert", " | ".join(parts), users=[user], link="/app/stock", kind="stock_alert", clinic_id=user.clinic_id)
    db.commit()
