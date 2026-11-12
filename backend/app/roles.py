"""Clinic classes, roles and module access rules."""
import json


ROLE_LABELS = {
    "admin": "Clinic admin", "doctor": "Doctor", "nurse": "Nurse",
    "lab_technician": "Lab technician", "pharmacist": "Pharmacist",
    "receptionist": "Receptionist", "accountant": "Accountant",
    "radiologist": "Radiologist",
    "pharmacy_seller": "Pharmacy seller",
}

# Every new clinic starts with these five roles. They follow the doctor -> lab -> pharmacy patient journey
# (one combined bill, one case file for every patient). The clinic admin creates the people for them later.
DEFAULT_ROLES = ["admin", "doctor", "nurse", "lab_technician", "pharmacist"]
# Custom roles a clinic admin will be able to switch on later. ON HOLD: nothing is defined yet, so none can be switched on.
# When they are defined, add them here (for example "receptionist", "accountant").
CUSTOM_ROLES = []
PHARMACY_ROLES = ["admin", "pharmacy_seller"]   # a pharmacy: its admin and its sellers


def custom_roles(clinic_class):
    return [] if clinic_class == "P" else CUSTOM_ROLES


def extra_roles(clinic):
    """The custom roles this clinic's admin has switched on (a JSON list on the clinic; empty by default)."""
    try:
        saved = json.loads(clinic.extra_roles) if clinic.extra_roles else []
    except ValueError:
        saved = []
    return [r for r in custom_roles(clinic.clinic_class) if r in saved]


def enabled_roles(clinic):
    """Roles the clinic admin may give to staff right now: the defaults plus any custom roles switched on."""
    if clinic.clinic_class == "P":
        return PHARMACY_ROLES
    return DEFAULT_ROLES + extra_roles(clinic)
_B = ["patients", "appointments", "visits", "lab", "pharmacy", "inventory", "billing", "prices", "accounts"]
CLASS_MODULES = {"B": _B + ["cases"], "A": _B + ["imaging", "hr", "payroll"]}
CLASS_MODULES["P"] = ["products", "suppliers", "purchases", "sales", "accounts"]
CLASS_NAMES = {"A": "Clinic", "B": "Clinic", "P": "Pharmacy"}   # shown to people; the clinic class itself is internal

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
    "hr": {"write": [], "read": []},                      # leave: clinic admin only 
    "prices": {"write": ["accountant"], "read": ["receptionist", "doctor", "nurse", "lab_technician", "radiologist", "pharmacist"]},
    "payroll": {"write": [], "read": ["accountant"]},    # salaries: clinic admin pays, accountant can view 
    "cases": {"write": ["doctor", "pharmacist"], "read": ["nurse", "lab_technician"]},   # the patient journey
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
