"""Mobile money collection.

PAYMENT_MODE=simulated  -> every payment succeeds instantly, no real money moves (for testing).
PAYMENT_MODE=live       -> a request-to-pay is sent to the customer's phone through MTN MoMo and/or Airtel Money.
                           The customer approves it with their PIN, the provider confirms, and only then is the wallet credited.
The wallet is credited exactly once per payment, and only after the provider itself confirms the payment is successful.
"""
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta
import httpx
from fastapi import HTTPException
from .activity import log
from .config import settings
from .models import Clinic, PaymentRequest, User
from .subscriptions import renew
from .wallet import wallet_post

LABELS = {"mtn": "MTN Mobile Money", "airtel": "Airtel Money"}
TIMEOUT = 20
PENDING_TIMEOUT = timedelta(minutes=10)


def live() -> bool:
    return settings.PAYMENT_MODE == "live"


def _ready(net: str) -> bool:
    if net == "mtn":
        return bool(settings.MTN_SUBSCRIPTION_KEY and settings.MTN_API_USER and settings.MTN_API_KEY)
    return bool(settings.AIRTEL_CLIENT_ID and settings.AIRTEL_CLIENT_SECRET)


def options() -> dict:
    if live():
        return {"live": True, "card": False, "networks": [{"id": n, "label": LABELS[n]} for n in LABELS if _ready(n)]}
    return {"live": False, "card": True, "networks": [{"id": n, "label": LABELS[n] + " (demo)"} for n in LABELS]}


def msisdn(phone: str | None) -> str:
    cc = settings.PHONE_COUNTRY_CODE
    d = re.sub(r"\D", "", phone or "")
    if d.startswith("00"):
        d = d[2:]
    if d.startswith("0"):
        d = cc + d[1:]
    elif not d.startswith(cc) and len(d) == 9:
        d = cc + d
    if not d.startswith(cc) or len(d) != len(cc) + 9:
        raise HTTPException(422, "Enter a valid mobile money number, for example 0770 123 456.")
    return d


def mask(m: str) -> str:
    return m[:5] + "****" + m[-3:]


# ---------------------------------------------------------------- HTTP helpers
_tokens: dict = {}


def _cached(name, fetch):
    value, expires = _tokens.get(name, (None, 0))
    if value and time.time() < expires - 30:
        return value
    value, ttl = fetch()
    _tokens[name] = (value, time.time() + ttl)
    return value


def _http(method, url, **kw):
    try:
        return httpx.request(method, url, timeout=TIMEOUT, **kw)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Could not reach the mobile money provider ({type(e).__name__}). Try again in a moment.")


# ---------------------------------------------------------------- MTN MoMo (Collections)
def _mtn_token():
    def fetch():
        r = _http("POST", f"{settings.MTN_BASE_URL}/collection/token/", auth=(settings.MTN_API_USER, settings.MTN_API_KEY),
                  headers={"Ocp-Apim-Subscription-Key": settings.MTN_SUBSCRIPTION_KEY})
        if r.status_code != 200:
            raise HTTPException(502, f"MTN sign-in failed ({r.status_code}). Check the MTN keys in .env.")
        j = r.json()
        return j["access_token"], int(j.get("expires_in", 3600))
    return _cached("mtn", fetch)


def _mtn_headers(ref=None):
    h = {"Authorization": f"Bearer {_mtn_token()}", "X-Target-Environment": settings.MTN_TARGET_ENV,
         "Ocp-Apim-Subscription-Key": settings.MTN_SUBSCRIPTION_KEY}
    if ref:
        h["X-Reference-Id"] = ref
    return h


def _mtn_request(ref, phone, amount, note):
    h = _mtn_headers(ref)
    h["Content-Type"] = "application/json"
    if settings.PUBLIC_API_URL.startswith("https://"):
        h["X-Callback-Url"] = f"{settings.PUBLIC_API_URL}/api/payments/callback/mtn"
    body = {"amount": str(int(amount)), "currency": settings.MTN_CURRENCY, "externalId": ref,
            "payer": {"partyIdType": "MSISDN", "partyId": msisdn(phone)}, "payerMessage": note, "payeeNote": note}
    r = _http("POST", f"{settings.MTN_BASE_URL}/collection/v1_0/requesttopay", headers=h, json=body)
    if r.status_code != 202:
        raise HTTPException(502, f"MTN did not accept the payment request ({r.status_code}): {r.text[:200]}")


def _mtn_status(ref):
    r = _http("GET", f"{settings.MTN_BASE_URL}/collection/v1_0/requesttopay/{ref}", headers=_mtn_headers())
    if r.status_code != 200:
        return "pending", None, None
    j = r.json()
    s = (j.get("status") or "").upper()
    if s == "SUCCESSFUL":
        return "successful", None, j.get("financialTransactionId")
    if s == "FAILED":
        why = j.get("reason")
        why = why.get("message") if isinstance(why, dict) else why
        return "failed", (why or "The payment was declined or not approved.").replace("_", " ").capitalize(), None
    return "pending", None, None


# ---------------------------------------------------------------- Airtel Money
def _airtel_token():
    def fetch():
        r = _http("POST", f"{settings.AIRTEL_BASE_URL}/auth/oauth2/token", headers={"Content-Type": "application/json", "Accept": "*/*"},
                  json={"client_id": settings.AIRTEL_CLIENT_ID, "client_secret": settings.AIRTEL_CLIENT_SECRET, "grant_type": "client_credentials"})
        if r.status_code != 200:
            raise HTTPException(502, f"Airtel sign-in failed ({r.status_code}). Check the Airtel keys in .env.")
        j = r.json()
        return j["access_token"], int(j.get("expires_in", 3600))
    return _cached("airtel", fetch)


def _airtel_headers():
    return {"Authorization": f"Bearer {_airtel_token()}", "X-Country": settings.AIRTEL_COUNTRY, "X-Currency": settings.AIRTEL_CURRENCY,
            "Content-Type": "application/json", "Accept": "*/*"}


def _airtel_request(ref, phone, amount, note):
    c, cur = settings.AIRTEL_COUNTRY, settings.AIRTEL_CURRENCY
    body = {"reference": note[:60], "subscriber": {"country": c, "currency": cur, "msisdn": msisdn(phone)[len(settings.PHONE_COUNTRY_CODE):]},
            "transaction": {"amount": int(amount), "country": c, "currency": cur, "id": ref}}
    r = _http("POST", f"{settings.AIRTEL_BASE_URL}/merchant/v2/payments/", headers=_airtel_headers(), json=body)
    try:
        st = (r.json().get("status") or {})
    except ValueError:
        st = {}
    if r.status_code != 200 or st.get("success") is not True:
        raise HTTPException(502, f"Airtel did not accept the payment request: {st.get('message') or r.text[:200]}")


def _airtel_status(ref):
    r = _http("GET", f"{settings.AIRTEL_BASE_URL}/standard/v1/payments/{ref}", headers=_airtel_headers())
    if r.status_code != 200:
        return "pending", None, None
    tx = ((r.json().get("data") or {}).get("transaction") or {})
    code = (tx.get("status") or "").upper()
    if code == "TS":
        return "successful", None, tx.get("airtel_money_id") or tx.get("id")
    if code in ("TF", "TE"):
        return "failed", tx.get("message") or ("The payment expired." if code == "TE" else "The payment was declined or not approved."), None
    return "pending", None, None


_PROVIDERS = {"mtn": (_mtn_request, _mtn_status), "airtel": (_airtel_request, _airtel_status)}


# ---------------------------------------------------------------- public API
def simulated_topup(db, clinic, user, amount, method, phone=None) -> str:
    """Demo mode only: credits the wallet instantly. No money moves."""
    if method == "mobile_money":
        msisdn(phone)
    ref = "SIM-" + secrets.token_hex(4).upper()
    wallet_post(db, clinic, user, "topup", amount, method=method, reference=ref, description="Wallet top-up (demo payment)")
    return ref


def start(db, clinic, user, network, phone, amount, purpose) -> PaymentRequest:
    """Sends a payment request to the customer's phone. The wallet is NOT credited yet."""
    if network not in [n["id"] for n in options()["networks"]]:
        raise HTTPException(422, "Choose MTN Mobile Money or Airtel Money.")
    number = msisdn(phone)
    ref = str(uuid.uuid4())
    _PROVIDERS[network][0](ref, number, amount, f"ClinicPro {clinic.code}")
    req = PaymentRequest(clinic_id=clinic.id, user_id=user.id, user_name=user.full_name, provider=network, reference=ref, phone=number,
                         amount=amount, purpose=purpose)
    db.add(req)
    db.commit()
    return req


def settle(db, req: PaymentRequest) -> PaymentRequest:
    """Asks the provider for the real outcome. Credits the wallet once, and only on a confirmed success."""
    if req.status != "pending":
        return req
    state, reason, pref = _PROVIDERS[req.provider][1](req.reference)
    if state == "pending":
        if datetime.utcnow() - req.created_at > PENDING_TIMEOUT:
            req.status, req.reason, req.completed_at = "failed", "No approval was received on the phone in time.", datetime.utcnow()
            db.commit()
        return req
    if state == "failed":
        req.status, req.reason, req.completed_at = "failed", reason, datetime.utcnow()
        db.commit()
        return req
    # Confirmed success. The conditional update makes sure only one caller credits it.
    claimed = db.query(PaymentRequest).filter(PaymentRequest.id == req.id, PaymentRequest.credited.is_(False)).update({"credited": True})
    if not claimed:
        db.commit()
        db.refresh(req)
        return req
    req.status, req.provider_ref, req.completed_at = "successful", pref, datetime.utcnow()
    clinic, user = db.get(Clinic, req.clinic_id), db.get(User, req.user_id)
    wallet_post(db, clinic, user, "topup", req.amount, method="mobile_money", reference=pref or req.reference,
                description=f"{LABELS[req.provider]} from {mask(req.phone)}")
    log(db, user, "wallet", "topup", f"{user.full_name} added UGX {req.amount:,.0f} to the clinic wallet through {LABELS[req.provider]}",
        {"phone": mask(req.phone), "reference": pref or req.reference, "for": req.purpose})
    if req.purpose == "subscription":
        renew(db, clinic, user, method="mobile_money", ref=pref or req.reference)   # commits
    else:
        db.commit()
    return req
