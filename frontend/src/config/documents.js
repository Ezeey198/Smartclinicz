// What each printable document contains, and which roles may stamp it (the clinic admin may stamp all of them).
import { fmtStamp, label, ugx } from "../components/ui";

export const STAMPERS = {
  invoice: ["accountant", "cashier", "receptionist", "pharmacist"], receipt: ["cashier", "accountant", "pharmacist"],
  prescription: ["doctor", "pharmacist"], consultation: ["doctor", "nurse"], lab_report: ["lab_technician", "doctor"],
  imaging_report: ["radiologist", "doctor"], appointment_slip: ["receptionist", "nurse", "doctor"], goods_received: ["store_keeper", "pharmacist"],
  leave_letter: ["hr_manager"], salary_slip: ["hr_manager", "accountant"], patient_summary: ["records_officer", "doctor", "nurse", "receptionist"],
  expense_voucher: ["accountant"],
};

const when = (r) => fmtStamp(r.created_at);
const money = (n) => ugx(n);

export const DOCS = {
  invoice: (r) => ({ type: "invoice", id: r.id, ref: r.invoice_no, title: "Invoice",
    meta: [["Patient", r.patient_name], ["Date", when(r)], ["Status", label(r.status)], ["Raised by", r.created_by]],
    sections: [{ heading: "Charges", table: { cols: ["Description", "Amount"], rows: [[r.description, money(r.amount)]] } },
      { rows: [["Amount", money(r.amount)], ["Paid", money(r.paid)], ["Balance", money((r.amount || 0) - (r.paid || 0))]] }] }),
  receipt: (r) => ({ type: "receipt", id: r.id, ref: r.receipt_no, title: "Payment receipt",
    meta: [["Patient", r.patient_name], ["Invoice", r.invoice_no], ["Date", fmtStamp(r.created_at)], ["Method", label(r.method)]],
    sections: [{ rows: [["Amount received", money(r.amount)], ["Received by", r.received_by]] }] }),
  prescription: (r) => ({ type: "prescription", id: r.id, ref: `Rx ${String(r.id).padStart(5, "0")}`, title: "Prescription",
    meta: [["Patient", r.patient_name], ["Date", when(r)], ["Prescribed by", r.prescribed_by], ["Status", label(r.status)]],
    sections: [{ heading: "Medication", table: { cols: ["Drug", "Dosage", "Duration"], rows: [[r.drug, r.dosage, r.duration]] } }] }),
  consultation: (r) => ({ type: "consultation", id: r.id, ref: `CR ${String(r.id).padStart(5, "0")}`, title: "Consultation record",
    meta: [["Patient", r.patient_name], ["Date", when(r)], ["Recorded by", r.recorded_by]],
    sections: [{ heading: "Vital signs", rows: [["Temperature", r.temperature], ["Blood pressure", r.blood_pressure], ["Pulse", r.pulse], ["Weight", r.weight]] },
      { heading: "Complaints", text: r.complaints }, { heading: "Diagnosis", text: r.diagnosis }, { heading: "Treatment", text: r.treatment_notes }] }),
  lab_report: (r) => ({ type: "lab_report", id: r.id, ref: `LAB ${String(r.id).padStart(5, "0")}`, title: "Laboratory report",
    ready: r.status === "completed", readyNote: "Finish the test (status Completed) before stamping the report.",
    meta: [["Patient", r.patient_name], ["Requested", when(r)], ["Requested by", r.requested_by], ["Status", label(r.status)]],
    sections: [{ heading: "Test", text: r.test_name }, { heading: "Clinical notes", text: r.notes }, { heading: "Result", text: r.result }] }),
  imaging_report: (r) => ({ type: "imaging_report", id: r.id, ref: `IMG ${String(r.id).padStart(5, "0")}`, title: "Imaging report",
    ready: r.status === "reported", readyNote: "Release the report (status Reported) before stamping it.",
    meta: [["Patient", r.patient_name], ["Requested", when(r)], ["Requested by", r.requested_by], ["Status", label(r.status)]],
    sections: [{ rows: [["Examination", r.exam_type], ["Area", r.body_part]] }, { heading: "Clinical information", text: r.clinical_info }, { heading: "Findings", text: r.findings }] }),
  appointment_slip: (r) => ({ type: "appointment_slip", id: r.id, ref: `APT ${String(r.id).padStart(5, "0")}`, title: "Appointment slip",
    meta: [["Patient", r.patient_name], ["When", (r.scheduled_at || "").replace("T", " ")], ["Doctor", r.doctor_name || "Any doctor"], ["Status", label(r.status)]],
    sections: [{ heading: "Reason for visit", text: r.reason }] }),
  goods_received: (r) => ({ type: "goods_received", id: r.id, ref: `STK ${String(r.id).padStart(5, "0")}`, title: "Stock record",
    meta: [["Item", r.name], ["Category", r.category], ["Supplier", r.supplier], ["Expiry", r.expiry_date]],
    sections: [{ rows: [["Quantity in stock", `${r.quantity ?? 0} ${r.unit || ""}`], ["Reorder level", r.reorder_level]] }] }),
  leave_letter: (r) => ({ type: "leave_letter", id: r.id, ref: `LV ${String(r.id).padStart(5, "0")}`, title: "Leave letter",
    meta: [["Staff member", r.staff_name], ["Leave type", r.leave_type], ["Decision", label(r.status)]],
    sections: [{ rows: [["From", r.start_date], ["To", r.end_date]] }, { heading: "Reason", text: r.reason }] }),
  salary_slip: (r) => ({ type: "salary_slip", id: r.id, ref: `SAL ${String(r.id).padStart(5, "0")}`, title: "Salary slip",
    meta: [["Staff member", r.staff_name], ["Month", r.month], ["Paid by", r.paid_by]],
    sections: [{ rows: [["Amount paid", money(r.amount)]] }, { heading: "Note", text: r.note }] }),
  patient_summary: (r) => ({ type: "patient_summary", id: r.id, ref: r.patient_no, title: "Patient summary",
    meta: [["Name", r.full_name], ["Patient no.", r.patient_no], ["Gender", r.gender], ["Date of birth", r.date_of_birth]],
    sections: [{ rows: [["Phone", r.phone], ["Address", r.address], ["Blood group", r.blood_group], ["Next of kin", [r.next_of_kin, r.next_of_kin_phone].filter(Boolean).join(" · ")]] },
      { heading: "Known allergies", text: r.allergies }] }),
  expense_voucher: (r) => ({ type: "expense_voucher", id: r.id, ref: `EXP ${String(r.id).padStart(5, "0")}`, title: "Expense voucher",
    meta: [["Date", r.expense_date || when(r)], ["Category", r.category], ["Recorded by", r.recorded_by], ["Paid from", r.paid_from_wallet ? "Clinic wallet" : "Outside the wallet"]],
    sections: [{ heading: "Description", text: r.description }, { rows: [["Amount", money(r.amount)]] }] }),
};
