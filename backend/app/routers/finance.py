from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..activity import log
from ..database import get_db
from ..deps import clinic_member
from ..models import Expense, Invoice, Patient, Payment
from ..roles import COLLECTOR_ROLES, REPORT_ROLES
from ..wallet import wallet_post
from .records import _invoice, ser

router = APIRouter(prefix="/billing", tags=["finance"])


def collector(user=Depends(clinic_member)):
    if user.role not in COLLECTOR_ROLES:
        raise HTTPException(403, "Your role cannot receive payments.")
    return user


def reporter(user=Depends(clinic_member)):
    if user.role not in REPORT_ROLES:
        raise HTTPException(403, "Your role cannot open financial reports.")
    return user


@router.get("/summary")
def summary(user=Depends(reporter), db: Session = Depends(get_db)):
    cid = user.clinic_id
    invoices = db.query(Invoice).filter(Invoice.clinic_id == cid).all()
    expenses = db.query(Expense).filter(Expense.clinic_id == cid).all()
    months = {}
    row = lambda k: months.setdefault(k, {"month": k, "billed": 0.0, "collected": 0.0, "expenses": 0.0})
    for i in invoices:
        r = row(i.created_at.strftime("%Y-%m"))
        r["billed"] += i.amount or 0
        r["collected"] += i.paid or 0
    for e in expenses:
        row((e.expense_date or e.created_at.strftime("%Y-%m-%d"))[:7])["expenses"] += e.amount or 0
    billed = sum(i.amount or 0 for i in invoices)
    collected = sum(i.paid or 0 for i in invoices)
    spent = sum(e.amount or 0 for e in expenses)
    return {"billed": billed, "collected": collected, "outstanding": billed - collected, "expenses": spent, "net": collected - spent,
            "wallet_balance": user.clinic.wallet_balance or 0, "invoices": len(invoices), "unpaid": sum(1 for i in invoices if i.status != "paid"),
            "months": sorted(months.values(), key=lambda x: x["month"], reverse=True)[:12]}


class PayIn(BaseModel):
    amount: float = Field(gt=0)
    method: str = "cash"


@router.post("/{rid}/pay")
def pay(rid: int, body: PayIn, user=Depends(collector), db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == rid, Invoice.clinic_id == user.clinic_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    balance = (inv.amount or 0) - (inv.paid or 0)
    if body.amount > balance + 0.001:
        raise HTTPException(400, f"The balance on this invoice is only UGX {balance:,.0f}.")
    inv.paid = (inv.paid or 0) + body.amount
    _invoice(inv)
    p = Payment(clinic_id=user.clinic_id, invoice_id=inv.id, amount=body.amount, method=body.method, received_by=user.full_name)
    db.add(p)
    db.flush()
    patient = db.get(Patient, inv.patient_id)
    wallet_post(db, user.clinic, user, "payment_received", body.amount, method=body.method, reference=f"RCT-{p.id:06d}",
                description=f"{inv.invoice_no}: {inv.description}", invoice_id=inv.id)
    log(db, user, "billing", "paid", f"{user.full_name} received UGX {body.amount:,.0f} for {inv.invoice_no}" + (f" ({patient.full_name})" if patient else ""),
        {"invoice": inv.invoice_no, "for": inv.description, "patient": patient.full_name if patient else None, "amount": body.amount,
         "method": body.method, "balance_left": (inv.amount or 0) - (inv.paid or 0), "receipt": f"RCT-{p.id:06d}"})
    db.commit()
    return ser(inv)


@router.get("/payments")
def payments(user=Depends(collector), db: Session = Depends(get_db)):
    cid = user.clinic_id
    invs = {i.id: i for i in db.query(Invoice).filter(Invoice.clinic_id == cid)}
    names = {p.id: p.full_name for p in db.query(Patient).filter(Patient.clinic_id == cid)}
    rows = db.query(Payment).filter(Payment.clinic_id == cid).order_by(Payment.id.desc()).limit(500).all()
    return [{**ser(p), "receipt_no": f"RCT-{p.id:06d}", "invoice_no": invs[p.invoice_id].invoice_no if p.invoice_id in invs else None,
             "patient_name": names.get(invs[p.invoice_id].patient_id) if p.invoice_id in invs else None} for p in rows]
