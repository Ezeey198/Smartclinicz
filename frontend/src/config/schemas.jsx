// Field and column building blocks. Each role page picks what it needs from here.
import { Pill } from "../components/ui";

const GENDER = ["Female", "Male", "Other"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const payCol = { key: "payment_status", label: "Payment", render: (r) => (r.invoice_id ? <Pill value={r.payment_status} /> : <span className="sub">No charge</span>) };
const by = (list, names) => list.filter((x) => names.includes(x.name || x.key));

export const patientFields = [
  { name: "full_name", label: "Full name", required: true, full: true },
  { name: "gender", label: "Gender", type: "select", options: GENDER, required: true },
  { name: "date_of_birth", label: "Date of birth", type: "date" },
  { name: "phone", label: "Phone" },
  { name: "blood_group", label: "Blood group", type: "select", options: BLOOD },
  { name: "address", label: "Home address", full: true },
  { name: "next_of_kin", label: "Next of kin" },
  { name: "next_of_kin_phone", label: "Next of kin phone" },
  { name: "allergies", label: "Known allergies", type: "textarea", full: true },
];
export const patientColumns = [
  { key: "patient_no", label: "No." }, { key: "full_name", label: "Name", strong: true }, { key: "gender", label: "Gender" },
  { key: "phone", label: "Phone" }, { key: "blood_group", label: "Blood group" },
];

export const APPT_STATUS = ["scheduled", "checked_in", "completed", "cancelled"];
export const apptFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "scheduled_at", label: "Date and time", type: "datetime-local", required: true },
  { name: "doctor_name", label: "Doctor", type: "doctor" },
  { name: "reason", label: "Reason for visit", full: true },
  { name: "status", label: "Status", type: "select", options: APPT_STATUS, editOnly: true },
];
export const apptColumns = [
  { key: "scheduled_at", label: "When", type: "datetime", strong: true }, { key: "patient_name", label: "Patient" },
  { key: "doctor_name", label: "Doctor" }, { key: "reason", label: "Reason" }, payCol, { key: "status", label: "Status", pill: true },
];

export const visitFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "temperature", label: "Temperature (°C)" }, { name: "blood_pressure", label: "Blood pressure" },
  { name: "pulse", label: "Pulse (bpm)" }, { name: "weight", label: "Weight (kg)" },
  { name: "complaints", label: "Presenting complaints", type: "textarea", full: true },
  { name: "diagnosis", label: "Diagnosis", type: "textarea", full: true },
  { name: "treatment_notes", label: "Treatment notes", type: "textarea", full: true },
];
export const vitalsFields = by(visitFields, ["patient_id", "temperature", "blood_pressure", "pulse", "weight", "complaints"]);
export const visitColumns = [
  { key: "created_at", label: "Date", type: "date" }, { key: "patient_name", label: "Patient", strong: true },
  { key: "complaints", label: "Complaints" }, { key: "diagnosis", label: "Diagnosis" }, { key: "recorded_by", label: "Recorded by" },
];
export const vitalsColumns = [
  { key: "created_at", label: "Date", type: "date" }, { key: "patient_name", label: "Patient", strong: true },
  { key: "temperature", label: "Temp" }, { key: "blood_pressure", label: "BP" }, { key: "pulse", label: "Pulse" },
  { key: "weight", label: "Weight" }, { key: "recorded_by", label: "Recorded by" },
];

export const LAB_STATUS = ["requested", "in_progress", "completed"];
export const labFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "test_name", label: "Test", required: true },
  { name: "status", label: "Status", type: "select", options: LAB_STATUS },
  { name: "notes", label: "Clinical notes", type: "textarea", full: true },
  { name: "result", label: "Result", type: "textarea", full: true },
];
export const labRequestFields = by(labFields, ["patient_id", "test_name", "notes"]);
export const labColumns = [
  { key: "created_at", label: "Requested", type: "date" }, { key: "patient_name", label: "Patient", strong: true },
  { key: "test_name", label: "Test" }, { key: "requested_by", label: "Requested by" }, payCol, { key: "status", label: "Status", pill: true },
];
export const labResultColumns = [...labColumns.slice(0, 3), { key: "result", label: "Result" }, payCol, { key: "status", label: "Status", pill: true }];

export const RX_STATUS = ["pending", "dispensed", "cancelled"];
export const rxFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "drug", label: "Drug", required: true }, { name: "dosage", label: "Dosage" }, { name: "duration", label: "Duration" },
  { name: "status", label: "Status", type: "select", options: RX_STATUS },
];
export const rxPrescribeFields = by(rxFields, ["patient_id", "drug", "dosage", "duration"]);
export const rxColumns = [
  { key: "created_at", label: "Date", type: "date" }, { key: "patient_name", label: "Patient", strong: true },
  { key: "drug", label: "Drug" }, { key: "dosage", label: "Dosage" }, { key: "duration", label: "Duration" },
  { key: "prescribed_by", label: "Prescribed by" }, payCol, { key: "status", label: "Status", pill: true },
];

export const stockFields = [
  { name: "name", label: "Item name", required: true, full: true },
  { name: "category", label: "Category", type: "select", options: ["Medicine", "Supplies", "Equipment", "Consumables", "Other"] },
  { name: "unit", label: "Unit (packs, boxes…)" },
  { name: "quantity", label: "Quantity in stock", type: "number", required: true },
  { name: "reorder_level", label: "Reorder level", type: "number" },
  { name: "expiry_date", label: "Expiry date", type: "date" },
  { name: "supplier", label: "Supplier" },
];
export const stockColumns = [
  { key: "name", label: "Item", strong: true }, { key: "category", label: "Category" },
  { key: "quantity", label: "In stock", render: (r) => (
    <>{r.quantity} {r.unit || ""} {r.reorder_level != null && r.quantity <= r.reorder_level && <Pill tone="coral">Low</Pill>}</>) },
  { key: "reorder_level", label: "Reorder at" }, { key: "expiry_date", label: "Expires" }, { key: "supplier", label: "Supplier" },
];

export const IMG_STATUS = ["requested", "in_progress", "reported"];
export const imagingFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "exam_type", label: "Examination", type: "select", options: ["X-ray", "Ultrasound", "CT scan", "MRI", "Mammogram", "Other"], required: true },
  { name: "body_part", label: "Body part or area" },
  { name: "clinical_info", label: "Clinical information", type: "textarea", full: true },
  { name: "status", label: "Status", type: "select", options: IMG_STATUS },
  { name: "findings", label: "Radiology report", type: "textarea", full: true },
];
export const imagingRequestFields = by(imagingFields, ["patient_id", "exam_type", "body_part", "clinical_info"]);
export const imagingColumns = [
  { key: "created_at", label: "Requested", type: "date" }, { key: "patient_name", label: "Patient", strong: true },
  { key: "exam_type", label: "Exam" }, { key: "body_part", label: "Area" }, { key: "requested_by", label: "Requested by" },
  payCol, { key: "status", label: "Status", pill: true },
];

export const invoiceFields = [
  { name: "patient_id", label: "Patient", type: "patient", required: true, full: true },
  { name: "description", label: "What is this for?", required: true, full: true },
  { name: "amount", label: "Amount", type: "number", required: true },
  { name: "paid", label: "Amount paid", type: "number" },
];
export const invoiceRaiseFields = by(invoiceFields, ["patient_id", "description", "amount"]);
export const invoiceColumns = [
  { key: "invoice_no", label: "Invoice", strong: true }, { key: "patient_name", label: "Patient" }, { key: "description", label: "For" },
  { key: "amount", label: "Amount", type: "money" }, { key: "paid", label: "Paid", type: "money" },
  { key: "balance", label: "Balance", render: (r) => Number((r.amount || 0) - (r.paid || 0)).toLocaleString() },
  { key: "status", label: "Status", pill: true },
];
export const receiptColumns = [
  { key: "receipt_no", label: "Receipt", strong: true }, { key: "created_at", label: "Date", type: "stamp" },
  { key: "patient_name", label: "Patient" }, { key: "invoice_no", label: "Invoice" },
  { key: "amount", label: "Amount", type: "money" }, { key: "method", label: "Method" }, { key: "received_by", label: "Received by" },
];

export const expenseFields = [
  { name: "description", label: "Description", required: true, full: true },
  { name: "category", label: "Category", type: "select", options: ["Salaries", "Supplies", "Utilities", "Rent", "Maintenance", "Other"] },
  { name: "amount", label: "Amount", type: "number", required: true },
  { name: "expense_date", label: "Date", type: "date" },
  { name: "paid_from_wallet", label: "Pay from the clinic wallet?", type: "select", options: ["yes", "no"] },
];
export const expenseColumns = [
  { key: "expense_date", label: "Date" }, { key: "description", label: "Description", strong: true }, { key: "category", label: "Category" },
  { key: "amount", label: "Amount", type: "money" },
  { key: "paid_from_wallet", label: "Paid from", render: (r) => (r.paid_from_wallet ? <Pill tone="blue">Wallet</Pill> : <span className="sub">Outside wallet</span>) },
  { key: "recorded_by", label: "Recorded by" },
];

export const LEAVE_STATUS = ["pending", "approved", "rejected"];
export const leaveFields = [
  { name: "staff_id", label: "Staff member", type: "staff", required: true, full: true },
  { name: "leave_type", label: "Leave type", type: "select", options: ["Annual", "Sick", "Maternity or paternity", "Unpaid", "Other"] },
  { name: "start_date", label: "From", type: "date", required: true }, { name: "end_date", label: "To", type: "date", required: true },
  { name: "reason", label: "Reason", full: true },
  { name: "status", label: "Status", type: "select", options: LEAVE_STATUS },
];
export const leaveColumns = [
  { key: "staff_name", label: "Staff member", strong: true }, { key: "leave_type", label: "Type" },
  { key: "start_date", label: "From" }, { key: "end_date", label: "To" }, { key: "reason", label: "Reason" },
  { key: "status", label: "Status", pill: true },
];

export const priceFields = [
  { name: "category", label: "What is being charged", type: "select", required: true,
    options: [{ value: "registration", label: "Patient registration" }, { value: "consultation", label: "Consultation (appointment)" }, { value: "lab", label: "Lab test" },
      { value: "imaging", label: "Imaging exam" }, { value: "pharmacy", label: "Medication" }] },
  { name: "name", label: "Item name (leave empty for the category default)", full: true },
  { name: "price", label: "Price (UGX)", type: "number", required: true },
];
export const priceColumns = [
  { key: "category", label: "Charged for", render: (r) => <b>{({ registration: "Patient registration", consultation: "Consultation", lab: "Lab test", imaging: "Imaging exam", pharmacy: "Medication" })[r.category] || r.category}</b> },
  { key: "name", label: "Item", render: (r) => r.name || <span className="sub">Any (default price)</span> },
  { key: "price", label: "Price (UGX)", type: "money" },
];

export const payrollFields = [
  { name: "staff_id", label: "Staff member", type: "staff", required: true, full: true },
  { name: "month", label: "Salary month", type: "month", required: true },
  { name: "amount", label: "Amount paid (UGX)", type: "number", required: true },
  { name: "note", label: "Note", full: true },
];
export const payrollColumns = [
  { key: "month", label: "Month", strong: true }, { key: "staff_name", label: "Staff member" }, { key: "amount", label: "Amount", type: "money" },
  { key: "note", label: "Note" }, { key: "paid_by", label: "Paid by" }, { key: "created_at", label: "Paid on", type: "stamp" },
];
