import Stamp from "../../components/Stamp";
import { fmtStamp, label, ugx } from "../../components/ui";

const Rows = ({ rows }) => <dl className="doc-rows">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>)}</dl>;
const Table = ({ cols, rows }) => (
  <table className="doc-table"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c ?? "-"}</td>)}</tr>)}</tbody></table>
);

// The finished case file exactly as the patient receives it: their details and their workflow, stamped. No staff name appears.
export default function PatientDocument({ doc }) {
  const p = doc.patient, c = doc.consultation, b = doc.bill, cl = doc.clinic;
  return (
    <div className="doc-sheet print-area">
      <header className="doc-head"><h2>{cl.name}</h2><p>{[cl.address, cl.city].filter(Boolean).join(", ")}</p><p>{cl.phone}</p></header>
      <div className="doc-title"><h3>Patient case file</h3><span>{doc.case_no}</span></div>
      <dl className="doc-meta">{[["Patient", p.full_name], ["Patient no.", p.patient_no], ["Visit No.", doc.visit_no ? `No. ${doc.visit_no}` : "-"], ["Opened", fmtStamp(doc.opened_at)], ["Closed", doc.closed_at ? fmtStamp(doc.closed_at) : "-"]]
        .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <section><h4>Patient information</h4><Rows rows={[["Gender", p.gender], ["Date of birth", p.date_of_birth], ["Phone", p.phone], ["Address", p.address], ["Blood group", p.blood_group], ["Allergies", p.allergies]]} /></section>
      <section><h4>Consultation</h4><Rows rows={[["Temperature", c.temperature], ["Blood pressure", c.blood_pressure], ["Pulse", c.pulse], ["Weight", c.weight], ["Complaints", c.complaints], ["Diagnosis", c.diagnosis], ["Treatment notes", c.treatment_notes]]} /></section>
      {doc.labs.length > 0 && <section><h4>Laboratory and imaging results</h4><Table cols={["Test", "Result"]} rows={doc.labs.map((l) => [l.test, l.result])} /></section>}
      {doc.prescriptions.length > 0 && <section><h4>Prescriptions</h4><Table cols={["Drug", "Dosage", "Duration", "Qty", "Status"]} rows={doc.prescriptions.map((x) => [x.drug, x.dosage, x.duration, x.quantity, label(x.status)])} /></section>}
      <section><h4>Bill</h4>
        <Table cols={["Item", "Qty", "Unit price", "Amount"]} rows={b.lines.map((l) => [l.description, l.quantity, ugx(l.unit_price), ugx(l.amount)])} />
        <Rows rows={[["Total", ugx(b.total)], ["Paid", ugx(b.paid)], ["Balance", ugx(b.balance)]]} /></section>
      {doc.payments.length > 0 && <section><h4>Payments received</h4><Table cols={["Receipt", "Date", "Method", "Amount"]} rows={doc.payments.map((x) => [x.receipt_no, fmtStamp(x.at), label(x.method), ugx(x.amount)])} /></section>}
      <section><h4>Patient workflow</h4><Table cols={["When", "Step"]} rows={doc.workflow.map((w) => [fmtStamp(w.at), w.step])} /></section>
      <footer className="doc-foot"><div className="stamps">{doc.stamp.image && doc.stamped_at ? <Stamp image={doc.stamp.image} ink={doc.stamp.ink} date={doc.stamped_at} clinic={cl.name} /> : <p className="doc-unstamped">Stamped copy</p>}</div></footer>
    </div>
  );
}
