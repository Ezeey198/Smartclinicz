"""Price list lookups and the automatic charges that clinic activities create."""
from fastapi import HTTPException
from sqlalchemy import func
from .models import Invoice, ServicePrice


def price_for(db, clinic_id, category, name):
    rows = db.query(ServicePrice).filter(ServicePrice.clinic_id == clinic_id, ServicePrice.category == category).all()
    n = (name or "").strip().lower()
    for r in rows:
        if r.name and r.name.strip().lower() == n:
            return r.price or 0
    for r in rows:
        if not (r.name or "").strip():
            return r.price or 0
    return 0


def next_invoice_no(db, clinic_id):
    top = db.query(func.max(Invoice.id)).filter(Invoice.clinic_id == clinic_id).scalar() or 0
    return f"INV-{top + 1:06d}"


def raise_invoice(db, user, patient_id, description, amount):
    inv = Invoice(clinic_id=user.clinic_id, invoice_no=next_invoice_no(db, user.clinic_id), patient_id=patient_id,
                  description=description, amount=amount, paid=0, status="unpaid", created_by=user.full_name)
    db.add(inv)
    db.flush()
    return inv


def charger(category, name_of, prefix, patient_of=lambda o: o.patient_id, link=True):
    """Returns a hook that raises an invoice for a new record when the price list has a price for it."""
    def run(db, user, obj, data):
        label = name_of(obj)
        price = price_for(db, user.clinic_id, category, label)
        if not price:
            return
        inv = raise_invoice(db, user, patient_of(obj), f"{prefix}: {label}" if label else prefix, price)
        if link:
            obj.invoice_id = inv.id
    return run


def pay_gate(blocked, what):
    """Stops a record moving to a later status until its invoice is paid. The clinic admin can override."""
    def run(db, user, obj, data):
        if user.role == "admin" or data.get("status") not in blocked or not getattr(obj, "invoice_id", None):
            return
        inv = db.get(Invoice, obj.invoice_id)
        if inv and inv.status != "paid":
            raise HTTPException(400, f"{inv.invoice_no} is not fully paid (UGX {(inv.amount or 0) - (inv.paid or 0):,.0f} due). The {what} can go ahead once payment is received.")
    return run
