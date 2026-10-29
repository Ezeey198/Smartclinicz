"""Clinic classes, roles and module access rules."""

ROLE_LABELS = {
    "admin": "Clinic admin", "doctor": "Doctor", "nurse": "Nurse",
    "lab_technician": "Lab technician", "pharmacist": "Pharmacist",
    "receptionist": "Receptionist", "cashier": "Cashier", "accountant": "Accountant",
    "radiologist": "Radiologist", "records_officer": "Records officer",
    "store_keeper": "Store keeper", "hr_manager": "HR manager",
}

# Class B: essential clinic. Class A: full role system.
CLASS_ROLES = {
    "B": ["admin", "doctor", "nurse", "lab_technician", "pharmacist"],
    "A": list(ROLE_LABELS.keys()),
}
_B = ["patients", "appointments", "visits", "lab", "pharmacy", "inventory", "billing", "prices", "accounts"]
CLASS_MODULES = {"B": _B, "A": _B + ["imaging", "hr", "payroll"]}
CLASS_NAMES = {"A": "Class A - full service", "B": "Class B - essential"}

ROLE_DESC = {
    "admin": "Full control of the clinic: staff, prices, wallet, subscription and every module.",
    "doctor": "Consultations, diagnosis, prescriptions, lab and imaging requests.",
    "nurse": "Triage, vital signs, check-in and patient care.",
    "lab_technician": "Processes paid lab requests and enters results.",
    "pharmacist": "Collects payment at the counter, dispenses prescriptions and manages pharmacy stock.",
    "receptionist": "Registers patients, books appointments and raises invoices.",
    "cashier": "Receives patient payments into the clinic wallet and issues receipts.",
    "accountant": "Invoices, expenses paid from the wallet, price list and financial reports.",
    "radiologist": "Reports on paid imaging requests such as X-ray and ultrasound.",
    "records_officer": "Maintains patient records and patient files.",
    "store_keeper": "Manages stock, receives supplies and pays for them from the wallet.",
    "hr_manager": "Staff directory, leave requests and salary payments.",
}

PATIENT_FILE_ROLES = ["admin", "doctor", "nurse", "records_officer"]
MONEY_ROLES = ["admin", "accountant", "cashier", "pharmacist"]     # can see the clinic wallet balance
COLLECTOR_ROLES = ["admin", "cashier", "accountant", "pharmacist"]  # can receive patient payments
REPORT_ROLES = ["admin", "accountant", "cashier"]                   # can open financial summaries
TOPUP_ROLES = ["admin", "accountant"]

# write = can create/edit, read = view only. Clinic admin always has write.
MODULE_ACCESS = {
    "patients": {"write": ["doctor", "nurse", "receptionist", "records_officer"],
                 "read": ["lab_technician", "pharmacist", "cashier", "accountant", "radiologist"]},
    "appointments": {"write": ["doctor", "nurse", "receptionist"], "read": ["records_officer"]},
    "visits": {"write": ["doctor", "nurse"], "read": ["records_officer"]},
    "lab": {"write": ["doctor", "lab_technician"], "read": ["nurse", "records_officer"]},
    "pharmacy": {"write": ["doctor", "pharmacist"], "read": ["nurse", "store_keeper", "records_officer"]},
    "inventory": {"write": ["pharmacist", "store_keeper"], "read": ["doctor", "nurse"]},
    "billing": {"write": ["cashier", "accountant", "receptionist", "pharmacist"], "read": []},
    "imaging": {"write": ["doctor", "radiologist"], "read": ["nurse", "records_officer"]},
    "accounts": {"write": ["accountant"], "read": ["cashier"]},
    "hr": {"write": ["hr_manager"], "read": []},
    "prices": {"write": ["accountant"], "read": ["receptionist", "cashier", "doctor", "nurse", "records_officer",
                                                  "lab_technician", "radiologist", "pharmacist"]},
    "payroll": {"write": ["hr_manager"], "read": ["accountant"]},
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
