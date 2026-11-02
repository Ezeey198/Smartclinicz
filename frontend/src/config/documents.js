// What each printable document contains, and which roles may stamp it (the clinic admin may stamp all of them).
import { fmtStamp, label, ugx } from "../components/ui";
import { EVENT_LABEL } from "../components/cases/meta";

export const STAMPERS = {
  invoice: ["accountant", "cashier", "receptionist", "pharmacist"], receipt: ["cashier", "accountant", "pharmacist"],
  prescription: ["doctor", "pharmacist"], consultation: ["doctor", "nurse"], lab_report: ["lab_technician", "doctor"],
  imaging_report: ["radiologist", "doctor"], appointment_slip: ["receptionist", "nurse", "doctor"], goods_received: ["store_keeper", "pharmacist"],
  leave_letter: ["hr_manager"], salary_slip: ["hr_manager", "accountant"], patient_summary: ["records_officer", "doctor", "nurse", "receptionist"],
  expense_voucher: ["accountant"], case_file: ["doctor", "pharmacist"],
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
  case_file: (d) => {
    const c = d.case, p = d.patient, t = d.totals;
    return { type: "case_file", id: c.id, ref: c.case_no, title: "Patient case file",
      ready: ["awaiting_payment", "completed"].includes(c.stage), readyNote: "The case file can be stamped once the pharmacy has generated the bill.",
      meta: [["Patient", p.full_name], ["Patient no.", p.patient_no], ["Doctor", c.doctor_name], ["Opened", fmtStamp(c.created_at)], ["Stage", label(c.stage)], ["Closed", c.closed_at ? fmtStamp(c.closed_at) : "-"]],
      sections: [
        { heading: "Patient information", rows: [["Gender", p.gender], ["Date of birth", p.date_of_birth], ["Phone", p.phone], ["Address", p.address], ["Blood group", p.blood_group], ["Allergies", p.allergies],
          ["Next of kin", [p.next_of_kin, p.next_of_kin_phone].filter(Boolean).join(" · ")]] },
        { heading: `Consultation by Dr ${c.doctor_name}`, rows: [["Temperature", c.temperature], ["Blood pressure", c.blood_pressure], ["Pulse", c.pulse], ["Weight", c.weight]] },
        { heading: "Complaints", text: c.complaints }, { heading: "Diagnosis", text: c.diagnosis }, { heading: "Treatment notes", text: c.treatment_notes },
        d.labs.length ? { heading: "Laboratory", table: { cols: ["Test", "Result", "Status"], rows: d.labs.map((l) => [l.test_name, l.result, label(l.status)]) } } : null,
        d.prescriptions.length ? { heading: "Prescribed drugs", table: { cols: ["Drug", "Dosage", "Duration", "Qty", "Status"], rows: d.prescriptions.map((r) => [r.drug, r.dosage, r.duration, r.quantity, label(r.status)]) } } : null,
        { heading: "Bill", table: { cols: ["Item", "Qty", "Unit price", "Amount"], rows: d.charges.map((x) => [x.description, x.quantity, ugx(x.unit_price), ugx(x.amount)]) } },
        { rows: [["Consultation and registration", ugx(t.registration + t.consultation)], ["Laboratory", ugx(t.lab)], ["Drugs", ugx(t.drug + t.other)], ["Total", ugx(t.total)], ["Paid", ugx(t.paid)], ["Balance", ugx(t.balance)]] },
        d.payments.length ? { heading: "Payments received", table: { cols: ["Receipt", "Date", "Method", "Amount", "Received by"], rows: d.payments.map((x) => [x.receipt_no, fmtStamp(x.created_at), label(x.method), ugx(x.amount), x.received_by]) } } : null,
        { heading: "Who handled this case", table: { cols: ["When", "Staff", "Step"], rows: d.events.map((e) => [fmtStamp(e.created_at), `${e.user_name} (${e.role_label})`, `${EVENT_LABEL[e.kind] || e.kind}${e.details ? ": " + e.details : ""}`]) } },
      ].filter(Boolean) };
  },
};
