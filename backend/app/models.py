import json
from datetime import datetime
from sqlalchemy import event, Column, Integer, String, Float, Boolean, DateTime, Text, LargeBinary, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base


def now():
    return datetime.utcnow()


class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    clinic_class = Column(String(1), nullable=False)
    name = Column(String(200), nullable=False)
    registration_number = Column(String(80))
    license_number = Column(String(80))
    email = Column(String(200))
    phone = Column(String(50))
    website = Column(String(200))
    address = Column(String(300))
    city = Column(String(100))
    district = Column(String(100))
    country = Column(String(100))
    description = Column(Text)
    latitude = Column(Float)           # exact position of the clinic, detected by the admin on their device (or typed)
    longitude = Column(Float)
    status = Column(String(20), default="pending")  # pending | active | suspended
    approval_token = Column(String(80), index=True)
    approved_at = Column(DateTime)
    active_until = Column(DateTime)            # subscription / trial end
    has_paid = Column(Boolean, default=False)  # False while still on the free trial
    wallet_balance = Column(Float, default=0)
    stamp_image = Column(Text)        # the clinic's digital stamp as a PNG data URL
    stamp_ink = Column(String(9))     # main ink colour of the stamp, used for the date line
    stamp_updated = Column(DateTime)
    extra_roles = Column(Text)        # JSON list: optional roles (receptionist, accountant, radiologist) the admin switched on; none by default
    public_profile = Column(Text)     # JSON: what the public page shows (tagline, about, services, locations, visibility)
    created_at = Column(DateTime, default=now)
    users = relationship("User", back_populates="clinic")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("clinic_id", "email"),)
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(200), nullable=False, index=True)
    phone = Column(String(50))
    role = Column(String(30), nullable=False)
    password_hash = Column(String(300))
    is_active = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)
    activation_token = Column(String(80), index=True)
    token_expires = Column(DateTime)
    activated_at = Column(DateTime)
    last_seen_activity_id = Column(Integer, default=0)
    extra_roles = Column(Text)           # JSON list: the other roles this person also holds (their sidebars are combined)
    avatar = Column(Text)                # profile picture as a small data URL
    qualification = Column(String(150))  # staff record
    job_title = Column(String(100))
    theme = Column(String(40))           # colour theme chosen for this account only
    failed_logins = Column(Integer, default=0)
    locked_at = Column(DateTime)         # set after 3 wrong passwords; the clinic admin sends a reset email to unlock
    created_at = Column(DateTime, default=now)
    clinic = relationship("Clinic", back_populates="users")


class RoleStr(str):
    """A user's main role that also equals each of their other roles, so every `user.role in (...)` and `user.role == ...` check in the
    system works for people who hold more than one role."""
    def __new__(cls, main, extra=()):
        s = super().__new__(cls, main)
        s.all = [str(main)] + [r for r in extra if r != main]
        return s

    def __eq__(self, other):
        return isinstance(other, str) and other in self.all

    def __ne__(self, other):
        return not self.__eq__(other)

    __hash__ = str.__hash__

    def __str__(self):
        return "".join((self,))


def _combine_roles(user, *args):
    d = user.__dict__
    if "role" not in d or "extra_roles" not in d or not d["role"]:
        return
    try:
        extra = json.loads(d["extra_roles"]) if d["extra_roles"] else []
    except ValueError:
        extra = []
    d["role"] = RoleStr(str(d["role"]), extra)      # written straight into the instance, so it is never saved back as a change


event.listen(User, "load", _combine_roles)
event.listen(User, "refresh", _combine_roles)


def role_list(user):
    return list(getattr(user.role, "all", [str(user.role)]))


class EmailOutbox(Base):
    __tablename__ = "email_outbox"
    id = Column(Integer, primary_key=True)
    to_email = Column(String(200))
    subject = Column(String(300))
    body_text = Column(Text)
    sent = Column(Boolean, default=False)
    error = Column(Text)
    created_at = Column(DateTime, default=now)


def _cid():
    return Column(Integer, ForeignKey("clinics.id"), index=True, nullable=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_no = Column(String(30))
    full_name = Column(String(150), nullable=False)
    gender = Column(String(20))
    date_of_birth = Column(String(20))
    phone = Column(String(50))
    address = Column(String(300))
    next_of_kin = Column(String(150))
    next_of_kin_phone = Column(String(50))
    blood_group = Column(String(10))
    allergies = Column(Text)
    email = Column(String(200), index=True)               # where the patient's account invitation goes (the patient's own or an attendant's)
    portal_password_hash = Column(String(300))
    portal_token = Column(String(80), index=True)         # invitation link: the patient accepts the account and chooses a password
    portal_token_expires = Column(DateTime)
    portal_active = Column(Boolean, default=False)
    portal_session_until = Column(DateTime)               # set once the patient has saved the final document: the session ends then
    created_at = Column(DateTime, default=now)


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    doctor_name = Column(String(150))
    scheduled_at = Column(String(30))
    reason = Column(String(300))
    status = Column(String(20), default="scheduled")
    invoice_id = Column(Integer)
    created_at = Column(DateTime, default=now)


class Visit(Base):
    __tablename__ = "visits"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    temperature = Column(String(20))
    blood_pressure = Column(String(20))
    pulse = Column(String(20))
    weight = Column(String(20))
    complaints = Column(Text)
    diagnosis = Column(Text)
    treatment_notes = Column(Text)
    recorded_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class LabOrder(Base):
    __tablename__ = "lab_orders"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    test_name = Column(String(200))
    encounter_id = Column(Integer, index=True)
    notes = Column(Text)
    result = Column(Text)
    status = Column(String(20), default="requested")
    department = Column(String(20), default="lab")       # lab | radiology (a radiologist does the same work as the lab technician)
    fee = Column(Float)                                   # the fee the lab technician or radiologist sets (can be zero)
    invoice_id = Column(Integer)
    requested_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    drug = Column(String(200))
    encounter_id = Column(Integer, index=True)
    quantity = Column(Float)
    dosage = Column(String(200))
    duration = Column(String(100))
    status = Column(String(20), default="pending")
    invoice_id = Column(Integer)
    prescribed_by = Column(String(150))
    frequency = Column(String(100))                    # how often: three times a day...
    query_note = Column(String(400))                   # the pharmacist's question to the doctor before dispensing
    query_status = Column(String(12))                  # open | answered
    query_reply = Column(String(400))
    dispensed_by = Column(String(150))                 # dispensing record
    dispensed_at = Column(DateTime)
    dispensed_stock = Column(String(300))              # the Stock IDs and batches it was taken from
    created_at = Column(DateTime, default=now)


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    invoice_no = Column(String(30))
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    description = Column(String(300))
    amount = Column(Float, default=0)
    paid = Column(Float, default=0)
    status = Column(String(20), default="unpaid")
    created_by = Column(String(150))
    created_at = Column(DateTime, default=now)





class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    name = Column(String(200), nullable=False)
    category = Column(String(80))
    quantity = Column(Float, default=0)
    unit = Column(String(30))
    reorder_level = Column(Float)
    expiry_date = Column(String(20))      # kept in step with the batches: the nearest expiry among stock still available
    supplier = Column(String(200))        # the supplier of the latest batch
    medicine_code = Column(String(20), index=True)     # Medicine ID, made automatically: MED-000001
    generic_name = Column(String(200))
    strength = Column(String(60))                      # e.g. 500mg
    dosage_form = Column(String(60))                   # tablet, syrup, injection...
    purchase_price = Column(Float)                     # usual prices; each batch keeps the prices it was really bought and sold at
    selling_price = Column(Float)
    prescription_only = Column(Boolean, default=False) # may only be dispensed against a prescription, never sold over the counter
    created_at = Column(DateTime, default=now)


class InventoryBatch(Base):
    """One received lot of an item (a 'stock entry'). Stock is kept in batches so each has its own expiry, prices and location."""
    __tablename__ = "inventory_batches"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    item_id = Column(Integer, index=True)
    stock_no = Column(String(20), index=True)          # Stock ID, made automatically: STK-000001
    batch_no = Column(String(60))
    mfg_date = Column(String(10))                      # manufacturing date
    qty_received = Column(Float, default=0)
    qty_available = Column(Float, default=0)
    purchase_price = Column(Float, default=0)          # per unit
    selling_price = Column(Float, default=0)           # per unit
    expiry_date = Column(String(10))
    supplier = Column(String(200))
    location = Column(String(120))                     # where it is kept: shelf, store or pharmacy location
    created_at = Column(DateTime, default=now)


class StockAdjustment(Base):
    """The history of every change to stock: received, dispensed, corrected, damaged, expired, returned or edited."""
    __tablename__ = "stock_adjustments"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    item_id = Column(Integer, index=True)
    batch_id = Column(Integer, index=True)
    stock_no = Column(String(20))
    kind = Column(String(20))
    change = Column(Float, default=0)
    before = Column(Float, default=0)
    after = Column(Float, default=0)
    reason = Column(String(300))
    user_name = Column(String(150))
    created_at = Column(DateTime, default=now)


class ImagingOrder(Base):
    __tablename__ = "imaging_orders"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    exam_type = Column(String(120))
    body_part = Column(String(120))
    clinical_info = Column(Text)
    findings = Column(Text)
    status = Column(String(20), default="requested")
    invoice_id = Column(Integer)
    requested_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    description = Column(String(300))
    category = Column(String(80))
    amount = Column(Float, default=0)
    expense_date = Column(String(20))
    paid_from_wallet = Column(Boolean, default=False)
    recorded_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    staff_id = Column(Integer, ForeignKey("users.id"), index=True)
    leave_type = Column(String(50))
    start_date = Column(String(20))
    end_date = Column(String(20))
    reason = Column(String(300))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=now)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    invoice_id = Column(Integer, index=True)
    amount = Column(Float, default=0)
    method = Column(String(30))
    reference = Column(String(80))                     # transaction reference (mobile money, card slip...)
    received_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class ServicePrice(Base):
    __tablename__ = "service_prices"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    category = Column(String(30))   # registration | consultation | lab | imaging | pharmacy | other
    name = Column(String(200))      # empty = default price for the whole category
    price = Column(Float, default=0)
    created_at = Column(DateTime, default=now)


class SalaryPayment(Base):
    __tablename__ = "salary_payments"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    staff_id = Column(Integer, ForeignKey("users.id"), index=True)
    month = Column(String(10))
    amount = Column(Float, default=0)
    note = Column(String(300))
    paid_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class WalletTx(Base):
    __tablename__ = "wallet_transactions"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    user_id = Column(Integer, index=True)
    user_name = Column(String(150))
    role = Column(String(30))
    kind = Column(String(30))   # topup | subscription | payment_received | expense | stock_purchase | salary
    amount = Column(Float)      # + money in, - money out
    balance_after = Column(Float)
    method = Column(String(30))
    reference = Column(String(60))
    description = Column(String(300))
    invoice_id = Column(Integer)
    created_at = Column(DateTime, default=now)


class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    amount = Column(Float)
    method = Column(String(30))
    reference = Column(String(60))
    paid_by = Column(String(150))
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    created_at = Column(DateTime, default=now)


class Activity(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    user_id = Column(Integer, index=True)
    user_name = Column(String(150))
    role = Column(String(30))
    module = Column(String(30))
    action = Column(String(30))
    summary = Column(String(400))
    details = Column(Text)
    created_at = Column(DateTime, default=now)


class PaymentRequest(Base):
    """A mobile money collection that was sent to a customer's phone and is waiting for approval."""
    __tablename__ = "payment_requests"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    user_id = Column(Integer)
    user_name = Column(String(150))
    provider = Column(String(20))                 # mtn | airtel
    reference = Column(String(60), unique=True, index=True)
    phone = Column(String(20))
    amount = Column(Float)
    purpose = Column(String(20))                  # topup | subscription
    status = Column(String(20), default="pending")  # pending | successful | failed
    provider_ref = Column(String(80))
    reason = Column(String(300))
    credited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)
    completed_at = Column(DateTime)


class StampUse(Base):
    """Every time somebody puts the clinic stamp on a document: who, which document, and when."""
    __tablename__ = "stamp_uses"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    user_id = Column(Integer, index=True)
    user_name = Column(String(150))
    role = Column(String(30))
    doc_type = Column(String(30), index=True)
    doc_id = Column(Integer, index=True)
    doc_ref = Column(String(80))
    stamped_at = Column(DateTime, default=now)


class Encounter(Base):
    """One patient journey in a clinic: doctor -> (lab) -> doctor -> pharmacy -> one bill."""
    __tablename__ = "encounters"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    case_no = Column(String(20))
    stage = Column(String(20), default="with_doctor")  # with_doctor | at_lab | back_to_doctor | at_pharmacy | awaiting_payment | completed
    doctor_id = Column(Integer)
    doctor_name = Column(String(150))
    complaints = Column(Text)
    diagnosis = Column(Text)
    treatment_notes = Column(Text)
    temperature = Column(String(20))
    blood_pressure = Column(String(20))
    pulse = Column(String(20))
    weight = Column(String(20))
    invoice_id = Column(Integer)
    visit_no = Column(Integer)                            # 1 for the first visit, 2 for the second, and so on
    consult_fee = Column(Float)                           # set by the doctor (can be zero) before the case moves on
    nurse_id = Column(Integer)
    nurse_name = Column(String(150))
    room = Column(String(40))
    bed = Column(String(40))
    final_doc = Column(Text)                              # the finished case file as the patient sees it (no staff names), saved when it is stamped and printed
    doc_ready_at = Column(DateTime)
    doc_saved_at = Column(DateTime)                       # the patient saved the final document: their session ends five minutes later
    created_at = Column(DateTime, default=now)
    closed_at = Column(DateTime)


class CaseEvent(Base):
    """Every step of a case: who did it and when. This is what the admin tracks."""
    __tablename__ = "case_events"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    encounter_id = Column(Integer, index=True)
    user_id = Column(Integer)
    user_name = Column(String(150))
    role = Column(String(30))
    kind = Column(String(30))
    details = Column(Text)
    created_at = Column(DateTime, default=now)


class CaseCharge(Base):
    """One line of the case bill: consultation fee, a lab test, a drug."""
    __tablename__ = "case_charges"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    encounter_id = Column(Integer, index=True)
    kind = Column(String(20))   # registration | consultation | lab | drug | other
    description = Column(String(300))
    quantity = Column(Float, default=1)
    unit_price = Column(Float, default=0)
    amount = Column(Float, default=0)
    ref_id = Column(Integer)
    added_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    name = Column(String(200), nullable=False)
    generic_name = Column(String(200))
    category = Column(String(80))
    unit = Column(String(30))
    sku = Column(String(60))
    reorder_level = Column(Float)
    selling_price = Column(Float, default=0)
    prescription_required = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    name = Column(String(200), nullable=False)
    phone = Column(String(50))
    email = Column(String(200))
    address = Column(String(300))
    contact_person = Column(String(150))
    notes = Column(String(300))
    created_at = Column(DateTime, default=now)


class StockBatch(Base):
    """Stock is kept in batches so expiry dates are tracked and the oldest stock is sold first."""
    __tablename__ = "stock_batches"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    product_id = Column(Integer, index=True)
    batch_no = Column(String(60))
    expiry_date = Column(String(10))
    quantity = Column(Float, default=0)
    cost_price = Column(Float, default=0)
    supplier_id = Column(Integer)
    purchase_id = Column(Integer)
    created_at = Column(DateTime, default=now)


class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    ref_no = Column(String(30))
    supplier_id = Column(Integer)
    supplier_invoice = Column(String(60))
    total_cost = Column(Float, default=0)
    paid_from_wallet = Column(Boolean, default=False)
    notes = Column(String(300))
    received_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    purchase_id = Column(Integer, index=True)
    product_id = Column(Integer)
    product_name = Column(String(200))
    batch_no = Column(String(60))
    expiry_date = Column(String(10))
    quantity = Column(Float)
    unit_cost = Column(Float)


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    receipt_no = Column(String(30))
    customer_name = Column(String(150))
    customer_phone = Column(String(50))
    subtotal = Column(Float, default=0)
    discount = Column(Float, default=0)
    total = Column(Float, default=0)
    payment_method = Column(String(20))
    amount_paid = Column(Float, default=0)
    change_given = Column(Float, default=0)
    sold_by_id = Column(Integer, index=True)
    sold_by = Column(String(150))
    status = Column(String(20), default="completed")  # completed | voided
    void_reason = Column(String(300))
    voided_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class SaleLine(Base):
    __tablename__ = "sale_lines"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    sale_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    product_name = Column(String(200))
    batch_id = Column(Integer)
    quantity = Column(Float)
    unit_price = Column(Float)
    unit_cost = Column(Float)
    line_total = Column(Float)


class SiteContent(Base):
    """Text the superadmin controls on the public website (the About page and the landing page)."""
    __tablename__ = "site_content"
    key = Column(String(40), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=now)


class MediaItem(Base):
    """A photo or video on a clinic's or pharmacy's public page. Files are stored in the database so they survive restarts."""
    __tablename__ = "media_items"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    kind = Column(String(10))        # photo | video
    source = Column(String(20))      # file | youtube | vimeo | direct
    title = Column(String(200))
    url = Column(String(500))        # for videos added by link
    mime = Column(String(60))
    blob = Column(LargeBinary)
    size = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)


CLINIC_DATA = [Patient, Appointment, Visit, LabOrder, Prescription, Invoice, InventoryItem, ImagingOrder, Expense, LeaveRequest, Payment,
               ServicePrice, SalaryPayment, WalletTx, SubscriptionPayment, Activity, PaymentRequest, StampUse, Encounter, CaseEvent, CaseCharge,
               Product, Supplier, StockBatch, Purchase, PurchaseLine, Sale, SaleLine, MediaItem]


class Notification(Base):
    """One notification for a staff member or a patient. Each is also sent by SMS (see notify.py)."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, index=True)
    user_id = Column(Integer, index=True)
    patient_id = Column(Integer, index=True)
    kind = Column(String(30), default="info")
    title = Column(String(200))
    body = Column(Text)
    link = Column(String(200))
    created_at = Column(DateTime, default=now)
    read_at = Column(DateTime)


class SmsOutbox(Base):
    __tablename__ = "sms_outbox"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, index=True)
    to_phone = Column(String(50))
    body = Column(Text)
    sent = Column(Boolean, default=False)
    tries = Column(Integer, default=0)
    error = Column(Text)
    created_at = Column(DateTime, default=now)


class Attendance(Base):
    """A clock-in at the clinic (taken only within 20 metres of the clinic's saved location) and the clock-out."""
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    user_id = Column(Integer, index=True)
    user_name = Column(String(150))
    clock_in = Column(DateTime, default=now)
    clock_out = Column(DateTime)
    latitude = Column(Float)
    longitude = Column(Float)
    distance_m = Column(Float)
    accuracy_m = Column(Float)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    sender_id = Column(Integer, index=True)
    recipient_id = Column(Integer, index=True)
    body = Column(Text)
    created_at = Column(DateTime, default=now)
    read_at = Column(DateTime)


class MedicineCategory(Base):
    __tablename__ = "medicine_categories"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    name = Column(String(100))
    description = Column(String(300))
    created_at = Column(DateTime, default=now)


class PharmPurchase(Base):
    """A request for medicines from a supplier. Receiving the delivery (checking quantities and expiry dates) puts the stock in."""
    __tablename__ = "pharm_purchases"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    ref_no = Column(String(20))
    supplier_id = Column(Integer)
    supplier_name = Column(String(200))
    purchase_date = Column(String(10))
    status = Column(String(12), default="ordered")      # ordered | partial | received | cancelled
    total = Column(Float, default=0)
    supplier_invoice = Column(String(60))
    notes = Column(String(300))
    created_by = Column(String(150))
    received_by = Column(String(150))
    received_at = Column(DateTime)
    paid_from_wallet = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class PharmPurchaseLine(Base):
    __tablename__ = "pharm_purchase_lines"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    purchase_id = Column(Integer, index=True)
    item_id = Column(Integer)
    item_name = Column(String(200))
    qty_ordered = Column(Float, default=0)
    qty_received = Column(Float, default=0)
    unit_cost = Column(Float, default=0)
    batch_no = Column(String(60))
    mfg_date = Column(String(10))
    expiry_date = Column(String(10))


class RetailSale(Base):
    """A walk-in sale of medicines and supplies to someone who is not a registered clinic patient. It takes from the same stock as dispensing."""
    __tablename__ = "retail_sales"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    receipt_no = Column(String(20))
    customer_name = Column(String(150))
    customer_phone = Column(String(50))
    subtotal = Column(Float, default=0)
    discount = Column(Float, default=0)
    total = Column(Float, default=0)
    payment_method = Column(String(20))
    payment_ref = Column(String(80))
    amount_paid = Column(Float, default=0)
    change_given = Column(Float, default=0)
    sold_by_id = Column(Integer, index=True)
    sold_by = Column(String(150))
    status = Column(String(20), default="completed")     # completed | refunded
    void_reason = Column(String(300))
    voided_by = Column(String(150))
    created_at = Column(DateTime, default=now)


class RetailSaleLine(Base):
    __tablename__ = "retail_sale_lines"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    sale_id = Column(Integer, index=True)
    item_id = Column(Integer, index=True)
    item_name = Column(String(200))
    quantity = Column(Float)
    unit_price = Column(Float)
    unit_cost = Column(Float)
    line_total = Column(Float)
    stock_used = Column(String(300))


class PharmReturn(Base):
    """A medicine brought back. It only goes back into available stock after inspection and the admin's approval."""
    __tablename__ = "pharm_returns"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    ref_no = Column(String(20))
    item_id = Column(Integer)
    item_name = Column(String(200))
    batch_id = Column(Integer)
    stock_no = Column(String(20))
    quantity = Column(Float)
    reason = Column(String(300))
    source = Column(String(30))                          # walk-in sale | patient dispensing | other
    sale_id = Column(Integer)
    customer_name = Column(String(150))
    refund_amount = Column(Float, default=0)
    refund_method = Column(String(20))
    inspection = Column(String(12))                      # good | damaged | expired
    inspection_note = Column(String(300))
    status = Column(String(20), default="awaiting_approval")   # awaiting_approval | approved | rejected
    recorded_by = Column(String(150))
    decided_by = Column(String(150))
    decided_at = Column(DateTime)
    decision_note = Column(String(300))
    created_at = Column(DateTime, default=now)


class Disposal(Base):
    """Expired, damaged or lost medicine taken out of stock, with how it was disposed of."""
    __tablename__ = "disposals"
    id = Column(Integer, primary_key=True)
    clinic_id = _cid()
    ref_no = Column(String(20))
    item_id = Column(Integer)
    item_name = Column(String(200))
    batch_id = Column(Integer)
    stock_no = Column(String(20))
    batch_no = Column(String(60))
    quantity = Column(Float)
    expiry_date = Column(String(10))
    reason = Column(String(20))                          # expired | damaged | lost
    method = Column(String(100))
    notes = Column(String(300))
    disposed_by = Column(String(150))
    created_at = Column(DateTime, default=now)
