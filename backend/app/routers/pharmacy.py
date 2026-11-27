"""The pharmacy system (organisation class P): stock in batches with expiry dates, suppliers, purchases, point-of-sale and reports.
Sales take the oldest non-expired batch first, record the cost for profit reporting, and are paid into the pharmacy wallet."""
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import phstock as ph
from ..activity import log
from ..database import get_db
from ..deps import clinic_admin_only, module_guard
from ..models import PharmCustomer, PharmRegister, PharmRx, Product, Purchase, PurchaseLine, Sale, SaleLine, StockBatch, Supplier
from ..notify import flush_sms, notify_roles
from ..wallet import wallet_post
from .records import ser

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])
read_products, write_products = module_guard("products"), module_guard("products", write=True)
sell, buy = module_guard("sales", write=True), module_guard("purchases", write=True)


def _today():
    return datetime.utcnow().strftime("%Y-%m-%d")


# ------------------------------------------------------------------ stock
@router.get("/stock")
def stock(user=Depends(read_products), db: Session = Depends(get_db)):
    today = _today()
    agg = {}
    for b in db.query(StockBatch).filter(StockBatch.clinic_id == user.clinic_id, StockBatch.quantity > 0):
        a = agg.setdefault(b.product_id, {"stock": 0.0, "expired": 0.0, "held": 0.0, "next": None})
        if (b.status or "usable") != "usable":
            a["held"] += b.quantity                       # quarantined or recalled: kept apart, never sold
        elif b.expiry_date and b.expiry_date < today:
            a["expired"] += b.quantity
        else:
            a["stock"] += b.quantity
            if b.expiry_date and (a["next"] is None or b.expiry_date < a["next"]):
                a["next"] = b.expiry_date
    out = []
    for p in db.query(Product).filter(Product.clinic_id == user.clinic_id).order_by(Product.name):
        a = agg.get(p.id, {"stock": 0.0, "expired": 0.0, "held": 0.0, "next": None})
        out.append({**ser(p), "stock": a["stock"], "expired_stock": a["expired"], "held_stock": a["held"], "next_expiry": a["next"],
                    "low": p.reorder_level is not None and a["stock"] <= p.reorder_level})
    return out


def _product(db, user, pid) -> Product:
    p = db.query(Product).filter(Product.id == pid, Product.clinic_id == user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Product not found.")
    return p


@router.get("/products/{pid}/batches")
def batches(pid: int, user=Depends(read_products), db: Session = Depends(get_db)):
    _product(db, user, pid)
    rows = db.query(StockBatch).filter(StockBatch.clinic_id == user.clinic_id, StockBatch.product_id == pid).order_by(StockBatch.expiry_date, StockBatch.id)
    return [ser(b) for b in rows]


def _check_expiry(p, expiry, mfg=None):
    """A medicine's batch needs an expiry date that has not passed; a manufacturing date must be in the past and before it."""
    t = _today()
    if expiry:
        try:
            datetime.strptime(expiry, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(422, f"{p.name}: the expiry date must be a real date.")
        if expiry <= t:
            raise HTTPException(400, f"{p.name} expires on {expiry}, which has passed or is today. Expired medicine cannot be received into stock.")
    elif p.prescription_required or p.controlled or p.dosage_form:
        raise HTTPException(422, f"{p.name}: enter the expiry date from the pack.")
    if mfg:
        try:
            datetime.strptime(mfg, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(422, f"{p.name}: the manufacturing date must be a real date.")
        if mfg > t or (expiry and mfg >= expiry):
            raise HTTPException(400, f"{p.name}: the manufacturing date must be in the past and before the expiry date.")


class BatchIn(BaseModel):
    batch_no: str | None = None
    mfg_date: str | None = None
    expiry_date: str | None = None
    location: str | None = Field(default=None, max_length=120)
    quantity: float = Field(gt=0)
    cost_price: float = Field(default=0, ge=0)


@router.post("/products/{pid}/batches", status_code=201)
def add_batch(pid: int, body: BatchIn, user=Depends(write_products), db: Session = Depends(get_db)):
    """Opening stock or a stock top-up that did not come through a purchase."""
    p = _product(db, user, pid)
    _check_expiry(p, body.expiry_date, body.mfg_date)
    b = StockBatch(clinic_id=user.clinic_id, product_id=p.id, batch_no=body.batch_no, expiry_date=body.expiry_date or None, quantity=body.quantity, cost_price=body.cost_price,
                   stock_no=ph.new_stock_no(db, user.clinic_id), qty_received=body.quantity, mfg_date=body.mfg_date or None, location=(body.location or p.location or None), status="usable")
    db.add(b)
    db.flush()
    ph.move(db, user, p, b, "received", body.quantity, 0, body.quantity, "Opening stock or top-up")
    log(db, user, "products", "updated", f"{user.full_name} added {body.quantity:g} {p.unit or 'units'} of {p.name} to stock", {"batch": body.batch_no, "expiry": body.expiry_date, "cost_price": body.cost_price})
    db.commit()
    return ser(b)


class AdjustIn(BaseModel):
    quantity: float = Field(ge=0)
    reason: str = Field(min_length=3)
    kind: str = "correction"             # correction | count | damaged | expired | lost


@router.post("/batches/{bid}/adjust")
def adjust_batch(bid: int, body: AdjustIn, user=Depends(write_products), db: Session = Depends(get_db)):
    """Set a batch to its true quantity: breakage, a stock count, or writing off expired stock."""
    b = db.query(StockBatch).filter(StockBatch.id == bid, StockBatch.clinic_id == user.clinic_id).first()
    if not b:
        raise HTTPException(404, "Batch not found.")
    p = db.get(Product, b.product_id)
    if body.kind not in ("correction", "count", "damaged", "expired", "lost"):
        raise HTTPException(422, "Choose what kind of adjustment this is.")
    ph.give_identity(db, b)
    old, b.quantity = b.quantity, body.quantity
    if body.quantity > (b.qty_received or 0):
        b.qty_received = body.quantity
    if p:
        ph.move(db, user, p, b, body.kind, body.quantity - old, old, body.quantity, body.reason)
    log(db, user, "products", "updated", f"{user.full_name} adjusted stock of {p.name if p else 'a product'}: {old:g} to {body.quantity:g}", {"reason": body.reason, "batch": b.batch_no, "stock_id": b.stock_no, "kind": body.kind})
    db.commit()
    return ser(b)


@router.get("/expiry")
def expiry(user=Depends(read_products), db: Session = Depends(get_db)):
    today, soon = _today(), (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%d")
    names = {p.id: p.name for p in db.query(Product).filter(Product.clinic_id == user.clinic_id)}
    expired, coming = [], []
    for b in db.query(StockBatch).filter(StockBatch.clinic_id == user.clinic_id, StockBatch.quantity > 0, StockBatch.expiry_date.isnot(None), StockBatch.expiry_date <= soon).order_by(StockBatch.expiry_date):
        days = (datetime.strptime(b.expiry_date, "%Y-%m-%d") - datetime.strptime(today, "%Y-%m-%d")).days
        row = {**ser(b), "product_name": names.get(b.product_id), "days_left": days, "value": (b.quantity or 0) * (b.cost_price or 0)}
        (expired if b.expiry_date < today else coming).append(row)
    return {"expired": expired, "soon": coming}


# ------------------------------------------------------------------ purchases
class PLine(BaseModel):
    product_id: int
    batch_no: str | None = None
    mfg_date: str | None = None
    expiry_date: str | None = None
    location: str | None = None
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0)


class PurchaseIn(BaseModel):
    supplier_id: int | None = None
    supplier_invoice: str | None = None
    notes: str | None = None
    pay_from_wallet: bool = False
    lines: list[PLine] = Field(min_length=1)


def _purchase(db, p):
    sup = db.get(Supplier, p.supplier_id) if p.supplier_id else None
    lines = db.query(PurchaseLine).filter(PurchaseLine.purchase_id == p.id).order_by(PurchaseLine.id).all()
    return {**ser(p), "supplier_name": sup.name if sup else None, "lines": [ser(x) for x in lines]}


@router.post("/purchases", status_code=201)
def receive_purchase(body: PurchaseIn, user=Depends(buy), db: Session = Depends(get_db)):
    """Goods received from a supplier: adds a batch of stock per line, and can pay the supplier from the wallet."""
    cid = user.clinic_id
    if body.supplier_id and not db.query(Supplier).filter(Supplier.id == body.supplier_id, Supplier.clinic_id == cid).first():
        raise HTTPException(422, "Choose a supplier from this pharmacy.")
    top = db.query(func.max(Purchase.id)).filter(Purchase.clinic_id == cid).scalar() or 0
    total = sum(l.quantity * l.unit_cost for l in body.lines)
    pur = Purchase(clinic_id=cid, ref_no=f"PO-{top + 1:06d}", supplier_id=body.supplier_id, supplier_invoice=body.supplier_invoice, total_cost=round(total, 2),
                   paid_from_wallet=body.pay_from_wallet and total > 0, notes=body.notes, received_by=user.full_name)
    db.add(pur)
    db.flush()
    for l in body.lines:
        p = _product(db, user, l.product_id)
        _check_expiry(p, l.expiry_date, l.mfg_date)
        db.add(PurchaseLine(clinic_id=cid, purchase_id=pur.id, product_id=p.id, product_name=p.name, batch_no=l.batch_no, expiry_date=l.expiry_date or None, quantity=l.quantity, unit_cost=l.unit_cost))
        nb = StockBatch(clinic_id=cid, product_id=p.id, batch_no=l.batch_no, expiry_date=l.expiry_date or None, quantity=l.quantity, cost_price=l.unit_cost,
                        supplier_id=body.supplier_id, purchase_id=pur.id, stock_no=ph.new_stock_no(db, cid), qty_received=l.quantity, mfg_date=l.mfg_date or None,
                        location=(l.location or p.location or None), status="usable")
        db.add(nb)
        db.flush()
        ph.move(db, user, p, nb, "received", l.quantity, 0, l.quantity, f"Received on {pur.ref_no}")
    if pur.paid_from_wallet:
        wallet_post(db, user.clinic, user, "stock_purchase", -total, method="wallet", reference=pur.ref_no, description=f"Purchase {pur.ref_no}")
    log(db, user, "purchases", "created", f"{user.full_name} received stock {pur.ref_no} (UGX {total:,.0f})", {"lines": len(body.lines), "paid_from_wallet": pur.paid_from_wallet})
    db.commit()
    return _purchase(db, pur)


@router.get("/purchases")
def purchases(user=Depends(module_guard("purchases")), db: Session = Depends(get_db)):
    sup = {s.id: s.name for s in db.query(Supplier).filter(Supplier.clinic_id == user.clinic_id)}
    rows = db.query(Purchase).filter(Purchase.clinic_id == user.clinic_id).order_by(Purchase.id.desc()).limit(300).all()
    return [{**ser(p), "supplier_name": sup.get(p.supplier_id)} for p in rows]


@router.get("/purchases/{pid}")
def purchase_detail(pid: int, user=Depends(module_guard("purchases")), db: Session = Depends(get_db)):
    p = db.query(Purchase).filter(Purchase.id == pid, Purchase.clinic_id == user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Purchase not found.")
    return _purchase(db, p)


# ------------------------------------------------------------------ sales (point of sale)
class SLine(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: float | None = None
    rx_confirmed: bool = False


class SaleIn(BaseModel):
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    prescription_id: int | None = None         # a verified prescription, needed for prescription-only and controlled medicines
    discount: float = Field(default=0, ge=0)
    payment_method: str = "cash"
    payment_ref: str | None = Field(default=None, max_length=80)       # mobile money or card transaction reference
    amount_paid: float | None = None
    lines: list[SLine] = Field(min_length=1)


def _sale(db, s):
    lines = db.query(SaleLine).filter(SaleLine.sale_id == s.id).order_by(SaleLine.id).all()
    return {**ser(s), "lines": [ser(l) for l in lines]}


@router.post("/sales", status_code=201)
def create_sale(body: SaleIn, user=Depends(sell), db: Session = Depends(get_db)):
    if body.payment_method not in ("cash", "mobile_money", "card"):
        raise HTTPException(422, "Choose cash, mobile money or card.")
    if body.payment_method != "cash" and not (body.payment_ref or "").strip():
        raise HTTPException(422, "Enter the transaction reference for this payment.")
    cid, today = user.clinic_id, _today()
    made, moves, subtotal, products = [], [], 0.0, {}
    for ln in body.lines:
        p = _product(db, user, ln.product_id)
        products[p.id] = p
        price = p.selling_price or 0
        if ln.unit_price is not None and abs(ln.unit_price - price) > 0.001:
            if user.role != "admin":
                raise HTTPException(403, "Only the pharmacy admin can change a price.")
            price = ln.unit_price
        batches = ph.usable_batches(db, cid, p.id)             # in stock, not expired, not quarantined or recalled; oldest expiry first
        have = sum(b.quantity for b in batches)
        if have + 1e-9 < ln.quantity:
            raise HTTPException(400, f"Not enough {p.name} in stock ({have:g} available that is fit to sell).")
        need = ln.quantity
        for b in batches:
            if need <= 1e-9:
                break
            take = min(b.quantity, need)
            before = b.quantity
            b.quantity -= take
            need -= take
            moves.append((p, b, take, before, b.quantity))
            made.append(SaleLine(clinic_id=cid, product_id=p.id, product_name=p.name, batch_id=b.id, quantity=take, unit_price=price, unit_cost=b.cost_price or 0, line_total=round(take * price, 2)))
            subtotal += take * price
    # prescription-only and controlled medicines need a prescription that the admin (the authorized professional) has verified
    needs_rx = [p.name for p in products.values() if p.prescription_required or p.controlled]
    rx = None
    if needs_rx:
        rx = body.prescription_id and db.query(PharmRx).filter(PharmRx.id == body.prescription_id, PharmRx.clinic_id == cid).first()
        if not rx:
            raise HTTPException(400, f"{', '.join(needs_rx)} needs a verified prescription. Record the prescription under Prescriptions and refer it to the pharmacy admin to verify, then choose it here.")
        if rx.status != "verified":
            raise HTTPException(400, f"Prescription {rx.rx_no} is {rx.status}. Only a verified prescription can be used for these medicines.")
    limit = 100.0 if user.role == "admin" else float(user.discount_pct or 0)         # a seller's discount permission is set by the admin
    if body.discount > subtotal * limit / 100 + 0.001:
        raise HTTPException(403, f"You can give a discount of up to {limit:g}% ({subtotal * limit / 100:,.0f} on this sale). Ask the pharmacy admin for more.")
    discount = min(body.discount, subtotal)
    total = round(subtotal - discount, 2)
    paid = body.amount_paid if (body.payment_method == "cash" and body.amount_paid is not None) else total
    if paid + 0.001 < total:
        raise HTTPException(400, f"The amount paid (UGX {paid:,.0f}) is less than the total (UGX {total:,.0f}).")
    cname, cphone = (body.customer_name or "").strip() or None, (body.customer_phone or "").strip() or None
    cust = None
    if body.customer_id:
        cust = db.query(PharmCustomer).filter(PharmCustomer.id == body.customer_id, PharmCustomer.clinic_id == cid).first()
        if not cust:
            raise HTTPException(404, "Customer not found.")
        cname, cphone = cust.name, cust.phone
    elif cphone:                                               # a phone number is enough to recognise the customer next time
        cust = db.query(PharmCustomer).filter(PharmCustomer.clinic_id == cid, PharmCustomer.phone == cphone).first() or PharmCustomer(clinic_id=cid, name=cname or "Customer", phone=cphone, created_by=user.full_name)
        if not cust.id:
            db.add(cust)
            db.flush()
        cname = cname or cust.name
    top = db.query(func.max(Sale.id)).filter(Sale.clinic_id == cid).scalar() or 0
    sale = Sale(clinic_id=cid, receipt_no=f"RC-{top + 1:06d}", customer_name=cname, customer_phone=cphone, customer_id=cust.id if cust else None, prescription_id=rx.id if rx else None,
                subtotal=round(subtotal, 2), discount=round(discount, 2), total=total, payment_method=body.payment_method, payment_ref=(body.payment_ref or "").strip() or None,
                amount_paid=paid, change_given=round(max(0, paid - total), 2), sold_by_id=user.id, sold_by=user.full_name,
                discount_by=(user.full_name if user.role == "admin" else f"{user.full_name} (allowed up to {limit:g}%)") if discount > 0 else None)
    db.add(sale)
    db.flush()
    for l in made:
        l.sale_id = sale.id
        db.add(l)
    for p, b, take, before, after in moves:                    # the stock movement register: every sale is a movement out
        ph.give_identity(db, b)
        ph.move(db, user, p, b, "sold", -take, before, after, f"Sale {sale.receipt_no}")
    if rx:
        rx.status, rx.sale_id = "dispensed", sale.id
    for p in products.values():
        left = ph.usable_total(db, cid, p.id)
        if p.controlled:                                       # the controlled medicines register
            qty = sum(t for (pp, _b, t, _x, _y) in moves if pp.id == p.id)
            db.add(PharmRegister(clinic_id=cid, kind="controlled", record_date=today, title=f"{p.name} dispensed", amount=qty, status="dispensed", recorded_by=user.full_name, recorded_by_id=user.id,
                                 details=json.dumps({"medicine": p.name, "code": p.medicine_code, "quantity": qty, "balance_after": left, "customer": cname, "prescriber": rx.prescriber if rx else None, "prescription": rx.rx_no if rx else None, "receipt": sale.receipt_no})))
        before_total = left + sum(t for (pp, _b, t, _x, _y) in moves if pp.id == p.id)
        if p.reorder_level is not None and before_total > p.reorder_level >= left:       # fell to the reorder level just now
            notify_roles(db, cid, ["admin"], "Low stock", f"{p.name} is down to {left:g} {p.unit or ''}. Reorder level is {p.reorder_level:g}.", link="/app/stock", kind="stock_alert")
    if total > 0:
        wallet_post(db, user.clinic, user, "sale", total, method=body.payment_method, reference=sale.receipt_no, description=f"Sale {sale.receipt_no}" + (f" (ref {sale.payment_ref})" if sale.payment_ref else ""))
    items = sum(l.quantity for l in made)
    log(db, user, "sales", "created", f"{user.full_name} sold {items:g} item(s) for UGX {total:,.0f} ({sale.receipt_no})",
        {"receipt": sale.receipt_no, "total": total, "method": body.payment_method, "reference": sale.payment_ref, "customer": sale.customer_name, "discount": sale.discount,
         "discount_by": sale.discount_by, "prescription": rx.rx_no if rx else None, "items": [f"{l.product_name} x{l.quantity:g}" for l in made]})
    db.commit()
    flush_sms()
    return _sale(db, sale)


@router.get("/sales")
def list_sales(scope: str = "mine", day: str | None = None, user=Depends(module_guard("sales")), db: Session = Depends(get_db)):
    q = db.query(Sale).filter(Sale.clinic_id == user.clinic_id)
    if scope != "all" or user.role != "admin":
        q = q.filter(Sale.sold_by_id == user.id)
    if day:
        try:
            d0 = datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(422, "Use a date like 2026-11-30.")
        q = q.filter(Sale.created_at >= d0, Sale.created_at < d0 + timedelta(days=1))
    rows = q.order_by(Sale.id.desc()).limit(400).all()
    ids = [s.id for s in rows] or [0]
    items = dict(db.query(SaleLine.sale_id, func.sum(SaleLine.quantity)).filter(SaleLine.sale_id.in_(ids)).group_by(SaleLine.sale_id).all())
    return [{**ser(s), "items": float(items.get(s.id, 0))} for s in rows]


@router.get("/sales/{sid}")
def sale_detail(sid: int, user=Depends(module_guard("sales")), db: Session = Depends(get_db)):
    s = db.query(Sale).filter(Sale.id == sid, Sale.clinic_id == user.clinic_id).first()
    if not s or (user.role != "admin" and s.sold_by_id != user.id):
        raise HTTPException(404, "Sale not found.")
    return _sale(db, s)


class VoidIn(BaseModel):
    reason: str = Field(min_length=3)


@router.post("/sales/{sid}/void")
def void_sale(sid: int, body: VoidIn, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    """Cancels a sale: the stock goes back on the shelf and the money is taken out of the wallet again."""
    s = db.query(Sale).filter(Sale.id == sid, Sale.clinic_id == user.clinic_id).first()
    if not s:
        raise HTTPException(404, "Sale not found.")
    if s.status != "completed":
        raise HTTPException(400, "This sale was already cancelled.")
    for l in db.query(SaleLine).filter(SaleLine.sale_id == s.id):
        b = db.get(StockBatch, l.batch_id)
        if b and b.clinic_id == user.clinic_id:
            before = b.quantity or 0
            b.quantity = before + l.quantity
            prod = db.get(Product, l.product_id)
            ph.give_identity(db, b)
            if prod:
                ph.move(db, user, prod, b, "returned", l.quantity, before, b.quantity, f"Cancelled sale {s.receipt_no}")
    s.status, s.void_reason, s.voided_by = "voided", body.reason, user.full_name
    if s.total:
        wallet_post(db, user.clinic, user, "sale_void", -s.total, method=s.payment_method, reference=s.receipt_no, description=f"Cancelled sale {s.receipt_no}", allow_negative=True)
    log(db, user, "sales", "voided", f"{user.full_name} cancelled sale {s.receipt_no} (UGX {s.total:,.0f})", {"reason": body.reason, "sold_by": s.sold_by})
    db.commit()
    return _sale(db, s)


# ------------------------------------------------------------------ reports
@router.get("/reports/summary")
def report(days: int = 30, user=Depends(clinic_admin_only), db: Session = Depends(get_db)):
    days = max(1, min(days, 365))
    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    sales = db.query(Sale).filter(Sale.clinic_id == user.clinic_id, Sale.status == "completed", Sale.created_at >= since).all()
    ids = {s.id for s in sales}
    lines = [l for l in db.query(SaleLine).filter(SaleLine.clinic_id == user.clinic_id, SaleLine.sale_id.in_(ids or {0}))]
    revenue = sum(s.total or 0 for s in sales)
    cogs = sum((l.quantity or 0) * (l.unit_cost or 0) for l in lines)
    day, seller, method, prod = {}, {}, {}, {}
    for s in sales:
        d = day.setdefault(s.created_at.strftime("%Y-%m-%d"), {"day": s.created_at.strftime("%Y-%m-%d"), "revenue": 0.0, "count": 0})
        d["revenue"] += s.total or 0
        d["count"] += 1
        x = seller.setdefault(s.sold_by, {"name": s.sold_by, "count": 0, "revenue": 0.0})
        x["count"] += 1
        x["revenue"] += s.total or 0
        method[s.payment_method] = method.get(s.payment_method, 0) + (s.total or 0)
    for l in lines:
        p = prod.setdefault(l.product_name, {"name": l.product_name, "quantity": 0.0, "revenue": 0.0})
        p["quantity"] += l.quantity or 0
        p["revenue"] += l.line_total or 0
    return {"days": days, "revenue": revenue, "cost_of_goods": cogs, "gross_profit": revenue - cogs, "sales": len(sales),
            "average_sale": revenue / len(sales) if sales else 0, "items_sold": sum(l.quantity or 0 for l in lines),
            "by_day": sorted(day.values(), key=lambda r: r["day"]), "by_seller": sorted(seller.values(), key=lambda r: -r["revenue"]),
            "by_method": [{"method": k, "total": v} for k, v in method.items()], "top_products": sorted(prod.values(), key=lambda r: -r["revenue"])[:10]}
