from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
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
    status = Column(String(20), default="pending")  # pending | active | suspended
    approval_token = Column(String(80), index=True)
    approved_at = Column(DateTime)
    active_until = Column(DateTime)            # subscription / trial end
    has_paid = Column(Boolean, default=False)  # False while still on the free trial
    wallet_balance = Column(Float, default=0)
    stamp_image = Column(Text)        # the clinic's digital stamp as a PNG data URL
    stamp_ink = Column(String(9))     # main ink colour of the stamp, used for the date line
    stamp_updated = Column(DateTime)
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
    created_at = Column(DateTime, default=now)
    clinic = relationship("Clinic", back_populates="users")


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
    expiry_date = Column(String(20))
    supplier = Column(String(200))
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
    """One patient journey in a Class B clinic: doctor -> (lab) -> doctor -> pharmacy -> one bill."""
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


CLINIC_DATA = [Patient, Appointment, Visit, LabOrder, Prescription, Invoice, InventoryItem, ImagingOrder, Expense, LeaveRequest, Payment,
               ServicePrice, SalaryPayment, WalletTx, SubscriptionPayment, Activity, PaymentRequest, StampUse, Encounter, CaseEvent, CaseCharge]
