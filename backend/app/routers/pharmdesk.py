"""The clinic pharmacist's work beyond dispensing: medicine categories, suppliers, purchase requests and receiving, walk-in sales with receipts,
returns that need inspection and the admin's approval, expired and damaged medicine records, and the pharmacy reports.
Everything draws on the same stock as patient dispensing, every stock movement is recorded, and everything is logged so the clinic admin sees it."""
from datetime import datetime, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .. import stockkeeping as sk
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only, module_guard
from ..models import (Disposal, Encounter, InventoryBatch, InventoryItem, MedicineCategory, Patient, Payment, PharmPurchase, PharmPurchaseLine, PharmReturn, Prescription,
                      RetailSale, RetailSaleLine, StockAdjustment, Supplier, User, role_list)
from ..notify import flush_sms, notify_roles
from ..wallet import wallet_post

router = APIRouter(prefix="/pharm", tags=["pharmacy"])
read = module_guard("inventory")
write = module_guard("inventory", write=True)


def pread(user=Depends(pread)):
    """The pharmacy's records (sales, purchases, returns, reports) are for the pharmacist and the clinic admin only."""
    if not (user.role == "pharmacist" or user.role == "admin"):
        raise HTTPException(403, "Only the pharmacist or the clinic admin can see the pharmacy records.")
    return user


METHODS = Literal["cash", "mobile_money", "card"]
SOON = 60            # days before expiry that count as "expiring soon" in the reports


def staff(user=Depends(write)):
    """Only the pharmacist or the clinic admin may sell, buy, return, dispose of or approve."""
    if not (user.role == "pharmacist" or user.role == "admin"):
        raise HTTPException(403, "Only the pharmacist or the clinic admin can do this.")
    return user


def tell_admin(db, user, title, body, link):
    """Page alert and SMS to the clinic admin (nothing when the admin is the one acting)."""
    if user.role != "admin":
        notify_roles(db, user.clinic_id, ["admin"], title, body, link=link, kind="pharmacy")


def _today():
    return datetime.utcnow().strftime("%Y-%m-%d")


def _date(d, what="date"):
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        raise HTTPException(422, f"Enter a real {what}.")


def _item(db, user, iid) -> InventoryItem:
    it = db.query(InventoryItem).filter(InventoryItem.id == iid, InventoryItem.clinic_id == user.clinic_id).first()
    if not it:
        raise HTTPException(404, "Medicine not found.")
    return it


# ------------------------------------------------------------------ medicine categories
@router.get("/categories")
def categories(user=Depends(read), db: Session = Depends(get_db)):
    used = {}
    for (c,) in db.query(InventoryItem.category).filter(InventoryItem.clinic_id == user.clinic_id):
        used[c] = used.get(c, 0) + 1
    rows = db.query(MedicineCategory).filter(MedicineCategory.clinic_id == user.clinic_id).order_by(MedicineCategory.name).all()
    return [{"id": c.id, "name": c.name, "description": c.description, "items": used.get(c.name, 0)} for c in rows]


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=300)


@router.post("/categories", status_code=201)
def add_category(body: CategoryIn, user=Depends(staff), db: Session = Depends(get_db)):
    name = body.name.strip()
    if db.query(MedicineCategory.id).filter(MedicineCategory.clinic_id == user.clinic_id, MedicineCategory.name.ilike(name)).first():
        raise HTTPException(409, f"{name} already exists.")
    c = MedicineCategory(clinic_id=user.clinic_id, name=name, description=(body.description or "").strip() or None)
    db.add(c)
    log(db, user, "pharmacy", "created", f"{user.full_name} added the medicine category {name}")
    db.commit()
    return {"id": c.id, "name": c.name, "description": c.description, "items": 0}


@router.patch("/categories/{cid}")
def edit_category(cid: int, body: CategoryIn, user=Depends(staff), db: Session = Depends(get_db)):
    c = db.query(MedicineCategory).filter(MedicineCategory.id == cid, MedicineCategory.clinic_id == user.clinic_id).first()
    if not c:
        raise HTTPException(404, "Category not found.")
    old, new = c.name, body.name.strip()
    if new.lower() != old.lower() and db.query(MedicineCategory.id).filter(MedicineCategory.clinic_id == user.clinic_id, MedicineCategory.name.ilike(new)).first():
        raise HTTPException(409, f"{new} already exists.")
    c.name, c.description = new, (body.description or "").strip() or None
    for it in db.query(InventoryItem).filter(InventoryItem.clinic_id == user.clinic_id, InventoryItem.category == old):
        it.category = new
    log(db, user, "pharmacy", "updated", f"{user.full_name} changed the medicine category {old} to {new}")
    db.commit()
    return {"id": c.id, "name": c.name, "description": c.description}


@router.delete("/categories/{cid}")
def delete_category(cid: int, user=Depends(staff), db: Session = Depends(get_db)):
    c = db.query(MedicineCategory).filter(MedicineCategory.id == cid, MedicineCategory.clinic_id == user.clinic_id).first()
    if not c:
        raise HTTPException(404, "Category not found.")
    if db.query(InventoryItem.id).filter(InventoryItem.clinic_id == user.clinic_id, InventoryItem.category == c.name).first():
        raise HTTPException(400, "Medicines still use this category. Move them to another category first.")
    db.delete(c)
    log(db, user, "pharmacy", "deleted", f"{user.full_name} removed the medicine category {c.name}")
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ suppliers
def _supplier(db, s):
    pur = db.query(PharmPurchase).filter(PharmPurchase.supplier_id == s.id, PharmPurchase.status != "cancelled").all()
    return {"id": s.id, "name": s.name, "contact_person": s.contact_person, "phone": s.phone, "email": s.email, "address": s.address, "notes": s.notes,
            "purchases": len(pur), "total": round(sum(p.total or 0 for p in pur), 2)}


@router.get("/suppliers")
def suppliers(user=Depends(pread), db: Session = Depends(get_db)):
    return [_supplier(db, s) for s in db.query(Supplier).filter(Supplier.clinic_id == user.clinic_id).order_by(Supplier.name)]


class SupplierIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


@router.post("/suppliers", status_code=201)
def add_supplier(body: SupplierIn, user=Depends(staff), db: Session = Depends(get_db)):
    if db.query(Supplier.id).filter(Supplier.clinic_id == user.clinic_id, Supplier.name.ilike(body.name.strip())).first():
        raise HTTPException(409, f"{body.name.strip()} is already a supplier.")
    s = Supplier(clinic_id=user.clinic_id, **{k: ((v or "").strip() or None) for k, v in body.model_dump().items()})
    db.add(s)
    log(db, user, "pharmacy", "created", f"{user.full_name} added the supplier {s.name}")
    db.commit()
    return _supplier(db, s)


@router.patch("/suppliers/{sid}")
def edit_supplier(sid: int, body: SupplierIn, user=Depends(staff), db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == sid, Supplier.clinic_id == user.clinic_id).first()
    if not s:
        raise HTTPException(404, "Supplier not found.")
    for k, v in body.model_dump().items():
        setattr(s, k, (v or "").strip() or None)
    log(db, user, "pharmacy", "updated", f"{user.full_name} updated the supplier {s.name}")
    db.commit()
    return _supplier(db, s)


@router.delete("/suppliers/{sid}")
def delete_supplier(sid: int, user=Depends(staff), db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == sid, Supplier.clinic_id == user.clinic_id).first()
    if not s:
        raise HTTPException(404, "Supplier not found.")
    if db.query(PharmPurchase.id).filter(PharmPurchase.supplier_id == s.id).first():
        raise HTTPException(400, "This supplier has purchase records, so it cannot be removed.")
    db.delete(s)
    log(db, user, "pharmacy", "deleted", f"{user.full_name} removed the supplier {s.name}")
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ purchases: request, then receive the delivery
def _purchase(db, p):
    lines = db.query(PharmPurchaseLine).filter(PharmPurchaseLine.purchase_id == p.id).order_by(PharmPurchaseLine.id).all()
    return {"id": p.id, "ref_no": p.ref_no, "supplier_id": p.supplier_id, "supplier_name": p.supplier_name, "purchase_date": p.purchase_date, "status": p.status, "total": p.total,
            "supplier_invoice": p.supplier_invoice, "notes": p.notes, "created_by": p.created_by, "received_by": p.received_by,
            "received_at": p.received_at.isoformat() if p.received_at else None, "paid_from_wallet": bool(p.paid_from_wallet),
            "lines": [{"id": l.id, "item_id": l.item_id, "item_name": l.item_name, "qty_ordered": l.qty_ordered, "qty_received": l.qty_received, "unit_cost": l.unit_cost,
                       "batch_no": l.batch_no, "mfg_date": l.mfg_date, "expiry_date": l.expiry_date} for l in lines]}


@router.get("/purchases")
def purchases(user=Depends(pread), db: Session = Depends(get_db)):
    rows = db.query(PharmPurchase).filter(PharmPurchase.clinic_id == user.clinic_id).order_by(PharmPurchase.id.desc()).limit(300).all()
    return [_purchase(db, p) for p in rows]


class PLine(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0)


class PurchaseIn(BaseModel):
    supplier_id: int
    purchase_date: str | None = None
    notes: str | None = Field(default=None, max_length=300)
    lines: list[PLine] = Field(min_length=1)


@router.post("/purchases", status_code=201)
def request_purchase(body: PurchaseIn, user=Depends(staff), db: Session = Depends(get_db)):
    """A request for medicines from a supplier: which medicines, how many, at what price."""
    sup = db.query(Supplier).filter(Supplier.id == body.supplier_id, Supplier.clinic_id == user.clinic_id).first()
    if not sup:
        raise HTTPException(404, "Choose a supplier from the list.")
    p = PharmPurchase(clinic_id=user.clinic_id, ref_no=sk.next_code(db, PharmPurchase, PharmPurchase.ref_no, user.clinic_id, "PUR"), supplier_id=sup.id, supplier_name=sup.name,
                      purchase_date=_date(body.purchase_date) if body.purchase_date else _today(), notes=(body.notes or "").strip() or None, created_by=user.full_name, status="ordered")
    db.add(p)
    db.flush()
    total = 0.0
    for l in body.lines:
        it = _item(db, user, l.item_id)
        db.add(PharmPurchaseLine(clinic_id=user.clinic_id, purchase_id=p.id, item_id=it.id, item_name=it.name, qty_ordered=l.quantity, unit_cost=l.unit_cost))
        total += l.quantity * l.unit_cost
    p.total = round(total, 2)
    log(db, user, "pharmacy", "created", f"{user.full_name} requested medicines from {sup.name} ({p.ref_no}, UGX {p.total:,.0f})", {"purchase": p.ref_no, "lines": len(body.lines)})
    tell_admin(db, user, "Medicine purchase requested", f"{p.ref_no} from {sup.name}: UGX {p.total:,.0f}", "/app/purchases")
    db.commit()
    flush_sms()
    return _purchase(db, p)


class RecvLine(BaseModel):
    line_id: int
    quantity: float = Field(ge=0)
    batch_no: str | None = None
    mfg_date: str | None = None
    expiry_date: str | None = None
    selling_price: float | None = Field(default=None, ge=0)
    location: str | None = None


class ReceiveIn(BaseModel):
    lines: list[RecvLine]
    supplier_invoice: str | None = Field(default=None, max_length=60)
    pay_from_wallet: bool = False


@router.post("/purchases/{pid}/receive")
def receive_purchase(pid: int, body: ReceiveIn, user=Depends(staff), db: Session = Depends(get_db)):
    """Receiving a delivery: each line is checked (not more than ordered, a batch number, an expiry date that has not passed) and the stock goes in."""
    p = db.query(PharmPurchase).filter(PharmPurchase.id == pid, PharmPurchase.clinic_id == user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Purchase not found.")
    if p.status in ("received", "cancelled"):
        raise HTTPException(400, f"This purchase is already {p.status}.")
    lines = {l.id: l for l in db.query(PharmPurchaseLine).filter(PharmPurchaseLine.purchase_id == p.id)}
    today, cost, got = _today(), 0.0, []
    for r in body.lines:
        if r.quantity <= 0:
            continue
        l = lines.get(r.line_id)
        if not l:
            raise HTTPException(404, "A line does not belong to this purchase.")
        if r.quantity > (l.qty_ordered - (l.qty_received or 0)) + 1e-9:
            raise HTTPException(400, f"{l.item_name}: only {l.qty_ordered - (l.qty_received or 0):g} are still expected, so {r.quantity:g} cannot be received.")
        if not (r.batch_no or "").strip():
            raise HTTPException(422, f"{l.item_name}: enter the batch number printed on the pack.")
        exp = _date(r.expiry_date, f"expiry date for {l.item_name}")
        if exp <= today:
            raise HTTPException(400, f"{l.item_name} expires on {exp}, which has already passed or is today. Expired medicine cannot be received into stock.")
        if r.mfg_date and (_date(r.mfg_date, f"manufacturing date for {l.item_name}") > today or r.mfg_date >= exp):
            raise HTTPException(400, f"{l.item_name}: the manufacturing date must be in the past and before the expiry date.")
        it = db.get(InventoryItem, l.item_id)
        if not it:
            raise HTTPException(404, f"{l.item_name} is no longer in the medicine list.")
        sk.ensure_identity(db, user, it)
        no = r.batch_no.strip()
        if db.query(InventoryBatch.id).filter(InventoryBatch.item_id == it.id, InventoryBatch.batch_no == no).first():
            raise HTTPException(409, f"{l.item_name}: batch {no} is already in stock. Use Add stock to put more onto that batch.")
        b = sk.new_batch(db, user, it, batch_no=no, qty=r.quantity, purchase_price=l.unit_cost, selling_price=r.selling_price if r.selling_price is not None else (it.selling_price or 0),
                         expiry_date=exp, supplier=p.supplier_name, location=r.location, mfg_date=r.mfg_date, reason=f"Received on {p.ref_no}")
        l.qty_received = (l.qty_received or 0) + r.quantity
        l.batch_no, l.mfg_date, l.expiry_date = no, (r.mfg_date or None), exp
        cost += r.quantity * l.unit_cost
        got.append(f"{it.name} x{r.quantity:g} ({b.stock_no})")
    if not got:
        raise HTTPException(422, "Enter the quantity received for at least one medicine.")
    p.status = "received" if all((l.qty_received or 0) + 1e-9 >= l.qty_ordered for l in lines.values()) else "partial"
    p.supplier_invoice = (body.supplier_invoice or p.supplier_invoice or "").strip() or None
    p.received_by, p.received_at = user.full_name, datetime.utcnow()
    cost = round(cost, 2)
    if body.pay_from_wallet and cost > 0:
        wallet_post(db, user.clinic, user, "stock_purchase", -cost, method="wallet", reference=p.ref_no, description=f"Delivery on {p.ref_no} from {p.supplier_name}")
        p.paid_from_wallet = True
    log(db, user, "pharmacy", "received", f"{user.full_name} received a delivery on {p.ref_no} from {p.supplier_name}: {', '.join(got)}", {"purchase": p.ref_no, "cost": cost, "paid_from_wallet": body.pay_from_wallet})
    tell_admin(db, user, "Medicines received", f"{p.ref_no} from {p.supplier_name}: {', '.join(got)} (UGX {cost:,.0f})", "/app/purchases")
    db.commit()
    flush_sms()
    return _purchase(db, p)


@router.post("/purchases/{pid}/cancel")
def cancel_purchase(pid: int, user=Depends(staff), db: Session = Depends(get_db)):
    p = db.query(PharmPurchase).filter(PharmPurchase.id == pid, PharmPurchase.clinic_id == user.clinic_id).first()
    if not p or p.status != "ordered":
        raise HTTPException(400, "Only a purchase that has not received anything can be cancelled.")
    p.status = "cancelled"
    log(db, user, "pharmacy", "cancelled", f"{user.full_name} cancelled the purchase {p.ref_no}")
    db.commit()
    return _purchase(db, p)


# ------------------------------------------------------------------ walk-in sales
def _sale(db, s):
    lines = db.query(RetailSaleLine).filter(RetailSaleLine.sale_id == s.id).order_by(RetailSaleLine.id).all()
    return {"id": s.id, "receipt_no": s.receipt_no, "created_at": s.created_at.isoformat(), "customer_name": s.customer_name, "customer_phone": s.customer_phone,
            "subtotal": s.subtotal, "discount": s.discount, "total": s.total, "payment_method": s.payment_method, "payment_ref": s.payment_ref, "amount_paid": s.amount_paid,
            "change_given": s.change_given, "sold_by": s.sold_by, "status": s.status,
            "lines": [{"item_id": l.item_id, "item_name": l.item_name, "quantity": l.quantity, "unit_price": l.unit_price, "line_total": l.line_total, "stock_used": l.stock_used} for l in lines]}


@router.get("/sellable")
def sellable(user=Depends(pread), db: Session = Depends(get_db)):
    """Medicines and supplies that can be sold over the counter right now: not prescription-only, with unexpired stock, and the price of the batch that would be sold."""
    out = []
    for it in db.query(InventoryItem).filter(InventoryItem.clinic_id == user.clinic_id).order_by(InventoryItem.name):
        good = sk.good_stock(db, it)
        out.append({"id": it.id, "medicine_code": it.medicine_code, "name": it.name, "strength": it.strength, "dosage_form": it.dosage_form, "category": it.category, "unit": it.unit,
                    "prescription_only": bool(it.prescription_only), "available": good, "price": sk.next_batch_price(db, it) or it.selling_price or 0})
    return out


class SLine(BaseModel):
    item_id: int
    quantity: float = Field(gt=0)
    unit_price: float | None = Field(default=None, ge=0)


class SaleIn(BaseModel):
    customer_name: str | None = Field(default=None, max_length=150)
    customer_phone: str | None = Field(default=None, max_length=50)
    lines: list[SLine] = Field(min_length=1)
    discount: float = Field(default=0, ge=0)
    payment_method: METHODS = "cash"
    payment_ref: str | None = Field(default=None, max_length=80)
    amount_paid: float | None = Field(default=None, ge=0)


@router.post("/sales", status_code=201)
def new_sale(body: SaleIn, user=Depends(staff), db: Session = Depends(get_db)):
    """A walk-in sale. It takes from the same stock as dispensing (oldest unexpired batch first), never sells prescription-only or expired medicine, and always makes a receipt."""
    if body.payment_method != "cash" and not (body.payment_ref or "").strip():
        raise HTTPException(422, "Enter the transaction reference for this payment.")
    sale = RetailSale(clinic_id=user.clinic_id, receipt_no=sk.next_code(db, RetailSale, RetailSale.receipt_no, user.clinic_id, "RS"), customer_name=(body.customer_name or "").strip() or "Walk-in customer",
                      customer_phone=(body.customer_phone or "").strip() or None, payment_method=body.payment_method, payment_ref=(body.payment_ref or "").strip() or None,
                      sold_by_id=user.id, sold_by=user.full_name)
    db.add(sale)
    db.flush()
    subtotal, made, low = 0.0, [], []
    for l in body.lines:
        it = _item(db, user, l.item_id)
        if it.prescription_only:
            raise HTTPException(400, f"{it.name} is prescription-only. It can only be dispensed to a patient with a doctor's prescription, not sold over the counter.")
        sk.ensure_identity(db, user, it)
        default = sk.next_batch_price(db, it) or it.selling_price or 0
        price = default if l.unit_price is None else l.unit_price
        if price != default and user.role != "admin":
            raise HTTPException(403, f"Only the clinic admin can change the price of {it.name}.")
        if price <= 0:
            raise HTTPException(400, f"{it.name} has no selling price. Set it on the batch in Stock first.")
        before = it.quantity or 0
        used = sk.take(db, user, it, l.quantity, f"Walk-in sale {sale.receipt_no}", kind="sold")
        if used is None:
            raise HTTPException(400, f"Cannot sell {l.quantity:g} {it.name}: only {sk.good_stock(db, it):g} {it.unit or ''} that has not expired is in stock.")
        total = round(price * l.quantity, 2)
        subtotal += total
        db.add(RetailSaleLine(clinic_id=user.clinic_id, sale_id=sale.id, item_id=it.id, item_name=it.name, quantity=l.quantity, unit_price=price, unit_cost=used["cost"], line_total=total, stock_used=used["label"]))
        made.append(l.quantity)
    if body.discount > subtotal:
        raise HTTPException(400, "The discount is more than the total.")
    sale.subtotal, sale.discount = round(subtotal, 2), round(body.discount, 2)
    sale.total = round(subtotal - body.discount, 2)
    paid = body.amount_paid if (body.payment_method == "cash" and body.amount_paid is not None) else sale.total
    if paid + 0.001 < sale.total:
        raise HTTPException(400, f"The amount paid (UGX {paid:,.0f}) is less than the total (UGX {sale.total:,.0f}).")
    sale.amount_paid, sale.change_given = round(paid, 2), round(paid - sale.total, 2)
    wallet_post(db, user.clinic, user, "pharmacy_sale", sale.total, method=body.payment_method, reference=sale.receipt_no, description=f"Walk-in sale {sale.receipt_no}" + (f" (ref {sale.payment_ref})" if sale.payment_ref else ""))
    log(db, user, "pharmacy", "sold", f"{user.full_name} sold {sum(made):g} item(s) over the counter for UGX {sale.total:,.0f} ({sale.receipt_no})",
        {"receipt": sale.receipt_no, "total": sale.total, "method": sale.payment_method, "reference": sale.payment_ref, "customer": sale.customer_name})
    db.commit()
    flush_sms()
    return _sale(db, sale)


@router.get("/sales")
def sales(start: str | None = None, end: str | None = None, user=Depends(pread), db: Session = Depends(get_db)):
    q = db.query(RetailSale).filter(RetailSale.clinic_id == user.clinic_id)
    a, b = _range(start, end)
    rows = q.filter(RetailSale.created_at >= a, RetailSale.created_at < b).order_by(RetailSale.id.desc()).limit(500).all()
    return [_sale(db, s) for s in rows]


def _range(start, end):
    a = datetime.strptime(_date(start or _today()), "%Y-%m-%d")
    b = datetime.strptime(_date(end or start or _today()), "%Y-%m-%d") + timedelta(days=1)
    return a, b


# ------------------------------------------------------------------ returns: inspection, then the admin's approval
def _ret(r):
    return {"id": r.id, "ref_no": r.ref_no, "item_id": r.item_id, "item_name": r.item_name, "batch_id": r.batch_id, "stock_no": r.stock_no, "quantity": r.quantity, "reason": r.reason,
            "source": r.source, "sale_id": r.sale_id, "customer_name": r.customer_name, "refund_amount": r.refund_amount, "refund_method": r.refund_method, "inspection": r.inspection,
            "inspection_note": r.inspection_note, "status": r.status, "recorded_by": r.recorded_by, "decided_by": r.decided_by, "decided_at": r.decided_at.isoformat() if r.decided_at else None,
            "decision_note": r.decision_note, "created_at": r.created_at.isoformat()}


@router.get("/returns")
def returns(user=Depends(pread), db: Session = Depends(get_db)):
    return [_ret(r) for r in db.query(PharmReturn).filter(PharmReturn.clinic_id == user.clinic_id).order_by(PharmReturn.id.desc()).limit(300)]


class ReturnIn(BaseModel):
    item_id: int
    batch_id: int | None = None
    quantity: float = Field(gt=0)
    reason: str = Field(min_length=3, max_length=300)
    source: Literal["walk-in sale", "patient dispensing", "other"] = "walk-in sale"
    sale_id: int | None = None
    customer_name: str | None = Field(default=None, max_length=150)
    refund_amount: float = Field(default=0, ge=0)
    refund_method: METHODS | None = None
    inspection: Literal["good", "damaged", "expired"]
    inspection_note: str | None = Field(default=None, max_length=300)


@router.post("/returns", status_code=201)
def record_return(body: ReturnIn, user=Depends(staff), db: Session = Depends(get_db)):
    """A medicine brought back. The pharmacist records it with the inspection result. It does not re-enter stock, and no refund is paid, until the admin approves."""
    it = _item(db, user, body.item_id)
    batch = None
    if body.batch_id:
        batch = db.query(InventoryBatch).filter(InventoryBatch.id == body.batch_id, InventoryBatch.item_id == it.id).first()
        if not batch:
            raise HTTPException(404, "That batch does not belong to this medicine.")
    if body.inspection == "good" and not batch:
        raise HTTPException(422, "Choose the batch it came from. Only a returned medicine that passes inspection goes back into that batch.")
    if body.sale_id:
        sale = db.query(RetailSale).filter(RetailSale.id == body.sale_id, RetailSale.clinic_id == user.clinic_id).first()
        line = sale and db.query(RetailSaleLine).filter(RetailSaleLine.sale_id == sale.id, RetailSaleLine.item_id == it.id).first()
        if not line:
            raise HTTPException(404, "That sale did not include this medicine.")
        back = sum(r.quantity for r in db.query(PharmReturn).filter(PharmReturn.sale_id == sale.id, PharmReturn.item_id == it.id, PharmReturn.status != "rejected"))
        if body.quantity + back > line.quantity + 1e-9:
            raise HTTPException(400, f"Only {line.quantity - back:g} of {it.name} can still be returned for that sale.")
        if body.refund_amount > line.unit_price * body.quantity + 0.01:
            raise HTTPException(400, "The refund is more than was paid for these items.")
    r = PharmReturn(clinic_id=user.clinic_id, ref_no=sk.next_code(db, PharmReturn, PharmReturn.ref_no, user.clinic_id, "RET"), item_id=it.id, item_name=it.name, batch_id=batch.id if batch else None,
                    stock_no=batch.stock_no if batch else None, quantity=body.quantity, reason=body.reason.strip(), source=body.source, sale_id=body.sale_id,
                    customer_name=(body.customer_name or "").strip() or None, refund_amount=body.refund_amount, refund_method=body.refund_method or ("cash" if body.refund_amount else None),
                    inspection=body.inspection, inspection_note=(body.inspection_note or "").strip() or None, recorded_by=user.full_name, status="awaiting_approval")
    db.add(r)
    db.flush()
    log(db, user, "pharmacy", "returned", f"{user.full_name} recorded {r.quantity:g} {it.name} returned ({r.ref_no}), inspected as {r.inspection}; waiting for the admin's approval", {"return": r.ref_no, "refund": r.refund_amount})
    tell_admin(db, user, "Medicine return needs your approval", f"{r.ref_no}: {r.quantity:g} {it.name}, inspected as {r.inspection}" + (f", refund UGX {r.refund_amount:,.0f}" if r.refund_amount else ""), "/app/returns")
    if user.role == "admin":
        _decide(db, user, r, True, "Recorded and approved by the admin")
    db.commit()
    flush_sms()
    return _ret(r)


def _decide(db, user, r, approve, note):
    if r.status != "awaiting_approval":
        raise HTTPException(400, f"This return is already {r.status}.")
    it = db.get(InventoryItem, r.item_id)
    r.decided_by, r.decided_at, r.decision_note = user.full_name, datetime.utcnow(), (note or "").strip() or None
    if not approve:
        r.status = "rejected"
        log(db, user, "pharmacy", "rejected", f"{user.full_name} rejected the return {r.ref_no}: {r.decision_note or 'no reason given'}")
        return
    r.status = "approved"
    b = db.get(InventoryBatch, r.batch_id) if r.batch_id else None
    if r.inspection == "good" and b:                          # passed inspection and approved: back into available stock, and recorded
        before = b.qty_available or 0
        b.qty_available = round(before + r.quantity, 4)
        b.qty_received = max(b.qty_received or 0, b.qty_available)
        sk.record(db, user, it, b, "returned_by_patient", r.quantity, before, b.qty_available, f"Return {r.ref_no} passed inspection")
        sk.sync_item(db, it)
    else:                                                     # damaged or expired: never re-enters stock; it is recorded as a disposal
        db.add(Disposal(clinic_id=r.clinic_id, ref_no=sk.next_code(db, Disposal, Disposal.ref_no, r.clinic_id, "DSP"), item_id=r.item_id, item_name=r.item_name, batch_id=r.batch_id, stock_no=r.stock_no,
                        batch_no=b.batch_no if b else None, quantity=r.quantity, expiry_date=b.expiry_date if b else None, reason=r.inspection, method="Returned item, not restocked",
                        notes=f"Return {r.ref_no}. {r.inspection_note or ''}".strip(), disposed_by=user.full_name))
        sk.record(db, user, it, b, "returned_by_patient", 0, (b.qty_available if b else 0) or 0, (b.qty_available if b else 0) or 0, f"Return {r.ref_no} was {r.inspection}: not restocked")
    if r.refund_amount and r.refund_amount > 0:
        wallet_post(db, user.clinic, user, "refund", -r.refund_amount, method=r.refund_method, reference=r.ref_no, description=f"Refund for return {r.ref_no} ({r.item_name})", allow_negative=True)
        if r.sale_id:
            sale = db.get(RetailSale, r.sale_id)
            if sale and sum(x.refund_amount for x in db.query(PharmReturn).filter(PharmReturn.sale_id == sale.id, PharmReturn.status == "approved")) + 0.01 >= sale.total:
                sale.status = "refunded"
    log(db, user, "pharmacy", "approved", f"{user.full_name} approved the return {r.ref_no} ({r.quantity:g} {r.item_name}, {r.inspection})" + (f" and refunded UGX {r.refund_amount:,.0f}" if r.refund_amount else ""), {"return": r.ref_no})


class DecisionIn(BaseModel):
    note: str | None = Field(default=None, max_length=300)


@router.post("/returns/{rid}/approve")
def approve_return(rid: int, body: DecisionIn, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    r = db.query(PharmReturn).filter(PharmReturn.id == rid, PharmReturn.clinic_id == admin.clinic_id).first()
    if not r:
        raise HTTPException(404, "Return not found.")
    _decide(db, admin, r, True, body.note)
    db.commit()
    return _ret(r)


@router.post("/returns/{rid}/reject")
def reject_return(rid: int, body: DecisionIn, admin: User = Depends(clinic_admin_only), db: Session = Depends(get_db)):
    r = db.query(PharmReturn).filter(PharmReturn.id == rid, PharmReturn.clinic_id == admin.clinic_id).first()
    if not r:
        raise HTTPException(404, "Return not found.")
    _decide(db, admin, r, False, body.note or "Rejected")
    db.commit()
    return _ret(r)


# ------------------------------------------------------------------ expired and damaged medicines
def _disposal(d):
    return {"id": d.id, "ref_no": d.ref_no, "item_name": d.item_name, "stock_no": d.stock_no, "batch_no": d.batch_no, "quantity": d.quantity, "expiry_date": d.expiry_date, "reason": d.reason,
            "method": d.method, "notes": d.notes, "disposed_by": d.disposed_by, "created_at": d.created_at.isoformat()}


@router.get("/disposals")
def disposals(user=Depends(pread), db: Session = Depends(get_db)):
    return [_disposal(d) for d in db.query(Disposal).filter(Disposal.clinic_id == user.clinic_id).order_by(Disposal.id.desc()).limit(300)]


class DisposeIn(BaseModel):
    batch_id: int
    quantity: float = Field(gt=0)
    reason: Literal["expired", "damaged", "lost"]
    method: str = Field(min_length=2, max_length=100)
    notes: str | None = Field(default=None, max_length=300)


@router.post("/disposals", status_code=201)
def dispose(body: DisposeIn, user=Depends(staff), db: Session = Depends(get_db)):
    """Takes expired, damaged or lost medicine out of stock so it is never sold or dispensed, and records how it was disposed of."""
    b = db.query(InventoryBatch).filter(InventoryBatch.id == body.batch_id, InventoryBatch.clinic_id == user.clinic_id).first()
    if not b:
        raise HTTPException(404, "Batch not found.")
    it = db.get(InventoryItem, b.item_id)
    before = b.qty_available or 0
    if body.quantity > before + 1e-9:
        raise HTTPException(400, f"Only {before:g} are available in this batch.")
    b.qty_available = round(before - body.quantity, 4)
    sk.record(db, user, it, b, body.reason, -body.quantity, before, b.qty_available, f"{body.method}. {body.notes or ''}".strip())
    sk.sync_item(db, it)
    d = Disposal(clinic_id=user.clinic_id, ref_no=sk.next_code(db, Disposal, Disposal.ref_no, user.clinic_id, "DSP"), item_id=it.id, item_name=it.name, batch_id=b.id, stock_no=b.stock_no, batch_no=b.batch_no,
                 quantity=body.quantity, expiry_date=b.expiry_date, reason=body.reason, method=body.method.strip(), notes=(body.notes or "").strip() or None, disposed_by=user.full_name)
    db.add(d)
    log(db, user, "pharmacy", "disposed", f"{user.full_name} removed {body.quantity:g} {it.name} ({b.stock_no}) from stock as {body.reason}: {body.method}", {"disposal": d.ref_no})
    tell_admin(db, user, "Medicine removed from stock", f"{body.quantity:g} {it.name} ({b.stock_no}) {body.reason}. {body.method}", "/app/returns")
    db.commit()
    flush_sms()
    return _disposal(d)


# ------------------------------------------------------------------ overview and reports
@router.get("/overview")
def overview(user=Depends(pread), db: Session = Depends(get_db)):
    """The numbers the pharmacist and the clinic admin both watch."""
    cid, today = user.clinic_id, _today()
    a, b = _range(today, today)
    items = db.query(InventoryItem).filter(InventoryItem.clinic_id == cid).all()
    batches = [x for x in db.query(InventoryBatch).filter(InventoryBatch.clinic_id == cid) if (x.qty_available or 0) > 0 and x.expiry_date]
    soon = (datetime.utcnow() + timedelta(days=SOON)).strftime("%Y-%m-%d")
    sales_today = db.query(RetailSale).filter(RetailSale.clinic_id == cid, RetailSale.created_at >= a, RetailSale.created_at < b).all()
    return {"sales_today": round(sum(s.total or 0 for s in sales_today), 2), "sales_count_today": len(sales_today),
            "dispensed_today": db.query(Prescription).filter(Prescription.clinic_id == cid, Prescription.dispensed_at >= a, Prescription.dispensed_at < b).count(),
            "low_stock": sum(1 for i in items if i.reorder_level is not None and (i.quantity or 0) <= i.reorder_level),
            "expired": sum(1 for x in batches if x.expiry_date < today), "expiring_soon": sum(1 for x in batches if today <= x.expiry_date <= soon),
            "pending_returns": db.query(PharmReturn).filter(PharmReturn.clinic_id == cid, PharmReturn.status == "awaiting_approval").count(),
            "open_queries": db.query(Prescription).filter(Prescription.clinic_id == cid, Prescription.query_status == "open", Prescription.status == "pending").count(),
            "open_purchases": db.query(PharmPurchase).filter(PharmPurchase.clinic_id == cid, PharmPurchase.status.in_(["ordered", "partial"])).count()}


def _col(key, label, kind="text"):
    return {"key": key, "label": label, "kind": kind}


@router.get("/report/{kind}")
def report(kind: str, start: str | None = None, end: str | None = None, user=Depends(pread), db: Session = Depends(get_db)):
    """Daily (or any date range) pharmacy reports: sales, dispensing, purchases, stock, low stock, expiry, movements, returns, disposals, payments, prescriptions and staff."""
    cid, today = user.clinic_id, _today()
    a, b = _range(start, end)
    day = lambda d: d.strftime("%Y-%m-%d %H:%M") if d else ""
    items = {i.id: i for i in db.query(InventoryItem).filter(InventoryItem.clinic_id == cid)}
    rows, cols, total_key, title = [], [], None, ""
    if kind == "sales":
        title, total_key = "Walk-in sales", "total"
        cols = [_col("receipt", "Receipt"), _col("date", "Date"), _col("customer", "Customer"), _col("items", "Items"), _col("total", "Total (UGX)", "money"), _col("method", "Paid by"), _col("reference", "Reference"), _col("by", "Sold by")]
        for s in db.query(RetailSale).filter(RetailSale.clinic_id == cid, RetailSale.created_at >= a, RetailSale.created_at < b).order_by(RetailSale.id):
            n = db.query(RetailSaleLine).filter(RetailSaleLine.sale_id == s.id).count()
            rows.append({"receipt": s.receipt_no, "date": day(s.created_at), "customer": s.customer_name, "items": n, "total": s.total, "method": s.payment_method, "reference": s.payment_ref or "", "by": s.sold_by})
    elif kind == "dispensing":
        title = "Dispensing records"
        cols = [_col("date", "Date"), _col("patient", "Patient"), _col("case", "Case"), _col("medicine", "Medicine issued"), _col("quantity", "Quantity", "num"), _col("dosage", "Dosage"), _col("stock", "Stock used"), _col("by", "Dispensed by")]
        pats = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == cid)}
        encs = {e.id: e.case_no for e in db.query(Encounter).filter(Encounter.clinic_id == cid)}
        for r in db.query(Prescription).filter(Prescription.clinic_id == cid, Prescription.dispensed_at >= a, Prescription.dispensed_at < b).order_by(Prescription.dispensed_at):
            rows.append({"date": day(r.dispensed_at), "patient": pats.get(r.patient_id, ""), "case": encs.get(r.encounter_id, ""), "medicine": r.drug, "quantity": r.quantity,
                         "dosage": " ".join(x for x in (r.dosage, r.frequency, r.duration) if x), "stock": r.dispensed_stock or "", "by": r.dispensed_by or ""})
    elif kind == "prescriptions":
        title = "Prescription records"
        cols = [_col("date", "Date"), _col("patient", "Patient"), _col("doctor", "Doctor"), _col("medicine", "Medicine"), _col("dosage", "Dosage"), _col("frequency", "Frequency"), _col("duration", "Duration"), _col("quantity", "Quantity", "num"), _col("status", "Status")]
        pats = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == cid)}
        for r in db.query(Prescription).filter(Prescription.clinic_id == cid, Prescription.created_at >= a, Prescription.created_at < b).order_by(Prescription.id):
            rows.append({"date": day(r.created_at), "patient": pats.get(r.patient_id, ""), "doctor": r.prescribed_by or "", "medicine": r.drug, "dosage": r.dosage or "", "frequency": r.frequency or "", "duration": r.duration or "", "quantity": r.quantity, "status": r.status})
    elif kind == "purchases":
        title, total_key = "Medicine purchases", "total"
        cols = [_col("ref", "Purchase"), _col("date", "Date"), _col("supplier", "Supplier"), _col("medicines", "Medicines"), _col("status", "Status"), _col("total", "Total (UGX)", "money")]
        for p in db.query(PharmPurchase).filter(PharmPurchase.clinic_id == cid, PharmPurchase.purchase_date >= a.strftime("%Y-%m-%d"), PharmPurchase.purchase_date < b.strftime("%Y-%m-%d")).order_by(PharmPurchase.id):
            ls = db.query(PharmPurchaseLine).filter(PharmPurchaseLine.purchase_id == p.id).all()
            rows.append({"ref": p.ref_no, "date": p.purchase_date, "supplier": p.supplier_name, "medicines": "; ".join(f"{l.item_name} x{l.qty_ordered:g}" for l in ls), "status": p.status, "total": p.total})
    elif kind == "stock":
        title, total_key = "Stock levels", "value"
        cols = [_col("code", "Medicine ID"), _col("name", "Medicine"), _col("category", "Category"), _col("available", "Available", "num"), _col("unit", "Unit"), _col("reorder", "Reorder level", "num"), _col("expiry", "Nearest expiry"), _col("value", "Value at cost (UGX)", "money")]
        bs = {}
        for x in db.query(InventoryBatch).filter(InventoryBatch.clinic_id == cid):
            bs.setdefault(x.item_id, []).append(x)
        for i in sorted(items.values(), key=lambda i: i.name or ""):
            rows.append({"code": i.medicine_code, "name": i.name, "category": i.category or "", "available": i.quantity or 0, "unit": i.unit or "", "reorder": i.reorder_level if i.reorder_level is not None else "",
                         "expiry": i.expiry_date or "", "value": round(sum((x.qty_available or 0) * (x.purchase_price or 0) for x in bs.get(i.id, [])), 2)})
    elif kind == "low":
        title = "Low stock"
        cols = [_col("code", "Medicine ID"), _col("name", "Medicine"), _col("available", "Available", "num"), _col("reorder", "Reorder level", "num"), _col("supplier", "Last supplier")]
        for i in sorted(items.values(), key=lambda i: i.name or ""):
            if i.reorder_level is not None and (i.quantity or 0) <= i.reorder_level:
                rows.append({"code": i.medicine_code, "name": i.name, "available": i.quantity or 0, "reorder": i.reorder_level, "supplier": i.supplier or ""})
    elif kind == "expiry":
        title = "Expired and expiring medicines"
        cols = [_col("name", "Medicine"), _col("stock_no", "Stock ID"), _col("batch", "Batch"), _col("quantity", "Quantity", "num"), _col("expiry", "Expiry date"), _col("status", "Status"), _col("location", "Location")]
        soon = (datetime.utcnow() + timedelta(days=SOON)).strftime("%Y-%m-%d")
        for x in db.query(InventoryBatch).filter(InventoryBatch.clinic_id == cid, InventoryBatch.qty_available > 0).order_by(InventoryBatch.expiry_date):
            if x.expiry_date and x.expiry_date <= soon:
                rows.append({"name": items[x.item_id].name if x.item_id in items else "", "stock_no": x.stock_no, "batch": x.batch_no or "", "quantity": x.qty_available, "expiry": x.expiry_date,
                             "status": "Expired" if x.expiry_date < today else "Expiring soon", "location": x.location or ""})
    elif kind == "movements":
        title = "Stock movements"
        cols = [_col("date", "Date"), _col("medicine", "Medicine"), _col("stock_no", "Stock ID"), _col("what", "Movement"), _col("change", "Change", "num"), _col("after", "Quantity after", "num"), _col("reason", "Reason"), _col("by", "By")]
        for h in db.query(StockAdjustment).filter(StockAdjustment.clinic_id == cid, StockAdjustment.created_at >= a, StockAdjustment.created_at < b).order_by(StockAdjustment.id):
            rows.append({"date": day(h.created_at), "medicine": items[h.item_id].name if h.item_id in items else "", "stock_no": h.stock_no or "", "what": h.kind, "change": h.change, "after": h.after, "reason": h.reason or "", "by": h.user_name})
    elif kind == "returns":
        title = "Medicine returns"
        cols = [_col("ref", "Return"), _col("date", "Date"), _col("medicine", "Medicine"), _col("quantity", "Quantity", "num"), _col("reason", "Reason"), _col("inspection", "Inspection"), _col("refund", "Refund (UGX)", "money"), _col("status", "Status")]
        for r in db.query(PharmReturn).filter(PharmReturn.clinic_id == cid, PharmReturn.created_at >= a, PharmReturn.created_at < b).order_by(PharmReturn.id):
            rows.append({"ref": r.ref_no, "date": day(r.created_at), "medicine": r.item_name, "quantity": r.quantity, "reason": r.reason, "inspection": r.inspection, "refund": r.refund_amount if r.status == "approved" else 0, "status": r.status})
        total_key = "refund"
    elif kind == "disposals":
        title = "Expired and damaged medicines"
        cols = [_col("ref", "Record"), _col("date", "Date"), _col("medicine", "Medicine"), _col("batch", "Batch"), _col("quantity", "Quantity", "num"), _col("expiry", "Expiry date"), _col("reason", "Reason"), _col("method", "Disposal"), _col("by", "By")]
        for d in db.query(Disposal).filter(Disposal.clinic_id == cid, Disposal.created_at >= a, Disposal.created_at < b).order_by(Disposal.id):
            rows.append({"ref": d.ref_no, "date": day(d.created_at), "medicine": d.item_name, "batch": f"{d.stock_no or ''} {d.batch_no or ''}".strip(), "quantity": d.quantity, "expiry": d.expiry_date or "", "reason": d.reason, "method": d.method, "by": d.disposed_by})
    elif kind == "payments":
        title, total_key = "Pharmacy payments", "amount"
        cols = [_col("date", "Date"), _col("source", "For"), _col("ref", "Receipt"), _col("amount", "Amount (UGX)", "money"), _col("method", "Method"), _col("reference", "Transaction reference"), _col("by", "Received by")]
        for s in db.query(RetailSale).filter(RetailSale.clinic_id == cid, RetailSale.created_at >= a, RetailSale.created_at < b).order_by(RetailSale.id):
            rows.append({"date": day(s.created_at), "source": "Walk-in sale", "ref": s.receipt_no, "amount": s.total, "method": s.payment_method, "reference": s.payment_ref or "", "by": s.sold_by})
        for p in db.query(Payment).filter(Payment.clinic_id == cid, Payment.created_at >= a, Payment.created_at < b).order_by(Payment.id):
            rows.append({"date": day(p.created_at), "source": "Patient bill", "ref": f"RCT-{p.id:06d}", "amount": p.amount, "method": p.method or "", "reference": p.reference or "", "by": p.received_by or ""})
        rows.sort(key=lambda r: r["date"])
    elif kind == "staff":
        title = "Pharmacy staff records"
        cols = [_col("name", "Name"), _col("phone", "Contact"), _col("email", "Email"), _col("qualification", "Qualification"), _col("job", "Job title"), _col("roles", "Assigned role")]
        for u in db.query(User).filter(User.clinic_id == cid, User.is_active.is_(True)).order_by(User.full_name):
            if u.role == "pharmacist":
                rows.append({"name": u.full_name, "phone": u.phone or "", "email": u.email, "qualification": u.qualification or "", "job": u.job_title or "", "roles": ", ".join(role_list(u))})
    else:
        raise HTTPException(404, "Unknown report.")
    totals = {total_key: round(sum(float(r[total_key] or 0) for r in rows), 2)} if total_key else {}
    return {"kind": kind, "title": title, "start": a.strftime("%Y-%m-%d"), "end": (b - timedelta(days=1)).strftime("%Y-%m-%d"), "columns": cols, "rows": rows, "totals": totals}
