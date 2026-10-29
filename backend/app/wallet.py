from fastapi import HTTPException
from .models import WalletTx


def wallet_post(db, clinic, user, kind, amount, method=None, reference=None, description=None, invoice_id=None):
    """Adds one line to the clinic wallet ledger. amount > 0 is money in, amount < 0 is money out."""
    amount = round(float(amount), 2)
    balance = round(clinic.wallet_balance or 0, 2)
    if balance + amount < -0.001:
        raise HTTPException(400, f"Not enough money in the clinic wallet (UGX {balance:,.0f} available, UGX {abs(amount):,.0f} needed). Top the wallet up first.")
    clinic.wallet_balance = round(balance + amount, 2)
    tx = WalletTx(clinic_id=clinic.id, user_id=user.id, user_name=user.full_name, role=user.role, kind=kind, amount=amount,
                  balance_after=clinic.wallet_balance, method=method, reference=reference, description=description, invoice_id=invoice_id)
    db.add(tx)
    db.flush()
    return tx
