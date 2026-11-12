"""Clinic classes, roles and module access rules."""
import json


ROLE_LABELS = {
    "admin": "Clinic admin", "doctor": "Doctor", "nurse": "Nurse",
    "lab_technician": "Lab technician", "pharmacist": "Pharmacist",
    "receptionist": "Receptionist", "accountant": "Accountant",
    "radiologist": "Radiologist",
    "pharmacy_seller": "Pharmacy seller",
}

# Every new clinic starts with these five roles, which follow the Class B work format
# (doctor -> lab -> pharmacy, one combined bill, one case file). The clinic admin creates the people for them later.
DEFAULT_ROLES = ["admin", "doctor", "nurse", "lab_technician", "pharmacist"]
# Roles the clinic admin can switch on later if the clinic needs them. Nothing is switched on by default.
OPTIONAL_ROLES = {"B": ["receptionist", "accountant"], "A": ["receptionist", "accountant", "radiologist"]}
CLASS_ROLES = {   # every role a class can ever have
    "B": DEFAULT_ROLES + OPTIONAL_ROLES["B"],
    "A": DEFAULT_ROLES + OPTIONAL_ROLES["A"],
    "P": ["admin", "pharmacy_seller"],   # a pharmacy: its admin and its sellers
}


def optional_roles(clinic_class):
    return OPTIONAL_ROLES.get(clinic_class, [])


def extra_roles(clinic):
    """The optional roles this clinic's admin has switched on (a JSON list on the clinic; empty by default)."""
    try:
        saved = json.loads(clinic.extra_roles) if clinic.extra_roles else []
    except ValueError:
        saved = []
    return [r for r in optional_roles(clinic.clinic_class) if r in saved]


def enabled_roles(clinic):
    """Roles the clinic admin may give to staff right now: the defaults plus any optional roles switched on."""
    if clinic.clinic_class == "P":
        return CLASS_ROLES["P"]
    return DEFAULT_ROLES + extra_roles(clinic)
_B = ["patients", "appointments", "visits", "lab", "pharmacy", "inventory", "billing", "prices", "accounts"]
CLASS_MODULES = {"B": _B + ["cases"], "A": _B + ["imaging", "hr", "payroll"]}
CLASS_MODULES["P"] = ["products", "suppliers", "purchases", "sales", "accounts"]
CLASS_NAMES = {"A": "Class A - full service", "B": "Class B - essential", "P": "Pharmacy"}

ROLE_DESC = {
    "admin": "Full control of the clinic: staff, prices, wallet, subscription and every module.",
    "doctor": "Consultations, diagnosis, prescriptions, lab and imaging requests.",
    "nurse": "Triage, vital signs, check-in and patient care.",
    "lab_technician": "Processes paid lab requests and enters results.",
    "pharmacist": "Collects payment at the counter, dispenses prescriptions and manages pharmacy stock.",
    "receptionist": "Registers patients, books appointments and raises invoices.",
    "accountant": "Invoices, expenses paid from the wallet, price list and financial reports.",
    "radiologist": "Reports on paid imaging requests such as X-ray and ultrasound.",
    "pharmacy_seller": "Sells medicines at the counter, takes payment and prints receipts.",
}
ADMIN_LABEL = {"P": "Pharmacy admin"}
ADMIN_DESC = {"P": "Full control of the pharmacy: products, stock, suppliers, purchases, sales, reports, staff, wallet and subscription."}


def label_for(role, clinic_class):
    """The admin of a pharmacy is called Pharmacy admin; everything else keeps its normal label."""
    return ADMIN_LABEL.get(clinic_class, ROLE_LABELS["admin"]) if role == "admin" else ROLE_LABELS.get(role, role)


def desc_for(role, clinic_class):
    return ADMIN_DESC.get(clinic_class, ROLE_DESC["admin"]) if role == "admin" else ROLE_DESC.get(role, "")

PATIENT_FILE_ROLES = ["admin", "doctor", "nurse"]
MONEY_ROLES = ["admin", "accountant", "pharmacist"]     # can see the clinic wallet balance
COLLECTOR_ROLES = ["admin", "accountant", "pharmacist"]  # can receive patient payments
REPORT_ROLES = ["admin", "accountant"]                   # can open financial summaries
TOPUP_ROLES = ["admin", "accountant"]

# write = can create/edit, read = view only. Clinic admin always has write.
MODULE_ACCESS = {
    "patients": {"write": ["doctor", "nurse", "receptionist"],
                 "read": ["lab_technician", "pharmacist", "accountant", "radiologist"]},
    "appointments": {"write": ["doctor", "nurse", "receptionist"], "read": []},
    "visits": {"write": ["doctor", "nurse"], "read": []},
    "lab": {"write": ["doctor", "lab_technician"], "read": ["nurse"]},
    "pharmacy": {"write": ["doctor", "pharmacist"], "read": ["nurse"]},
    "inventory": {"write": ["pharmacist"], "read": ["doctor", "nurse"]},
    "billing": {"write": ["accountant", "receptionist", "pharmacist"], "read": []},
    "imaging": {"write": ["doctor", "radiologist"], "read": ["nurse"]},
    "accounts": {"write": ["accountant"], "read": []},
    "hr": {"write": [], "read": []},                      # leave: clinic admin only (Class A)
    "prices": {"write": ["accountant"], "read": ["receptionist", "doctor", "nurse", "lab_technician", "radiologist", "pharmacist"]},
    "payroll": {"write": [], "read": ["accountant"]},    # salaries: clinic admin pays, accountant can view (Class A)
    "cases": {"write": ["doctor", "pharmacist"], "read": ["nurse", "lab_technician"]},   # Class B patient journey
    # pharmacies (class P)
    "products": {"write": [], "read": ["pharmacy_seller"]},
    "suppliers": {"write": [], "read": []},
    "purchases": {"write": [], "read": []},
    "sales": {"write": ["pharmacy_seller"], "read": []},
}


def module_level(clinic_class, role, module):
    if module not in CLASS_MODULES.get(clinic_class, []):
        return None
    if role == "admin":
        return "write"
    acc = MODULE_ACCESS[module]
    if role in acc["write"]:
        return "write"
    if role in acc["read"]:
        return "read"
    return None
