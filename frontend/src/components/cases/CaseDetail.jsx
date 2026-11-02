// Everything about one case in one place, from the doctor's first notes to the pharmacy's final bill.
import { useState } from "react";
import { Stamp as StampIcon } from "lucide-react";
import { useAuth } from "../../auth";
import { DOCS, STAMPERS } from "../../config/documents";
import DocumentModal from "../DocumentModal";
import { Pill, fmtStamp, label, ugx } from "../ui";
import { EVENT_LABEL, STAGE_LABEL } from "./meta";

const Block = ({ title, children }) => <section className="case-block"><h4>{title}</h4>{children}</section>;
const Text = ({ v }) => <p className="case-text">{v || <span className="sub">Nothing recorded yet.</span>}</p>;

export default function CaseDetail({ d }) {
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const { case: c, patient: p, totals: t } = d;
  const canStamp = user.role === "admin" || STAMPERS.case_file.includes(user.role);
  return (
    <div className="case">
      <div className="case-top">
        <div><h3>{p.full_name}</h3><span className="sub">{p.patient_no} · {p.gender}{p.phone ? ` · ${p.phone}` : ""} · Dr {c.doctor_name}</span></div>
        <div className="row"><Pill value={c.stage}>{STAGE_LABEL[c.stage]}</Pill>
          {canStamp && <button className="btn ghost sm" onClick={() => setDoc(DOCS.case_file(d))}><StampIcon size={14} />Print and stamp case file</button>}</div>
      </div>

      <Block title="Consultation">
        <dl className="vitals">{[["Temp", c.temperature], ["BP", c.blood_pressure], ["Pulse", c.pulse], ["Weight", c.weight]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>)}</dl>
        <p className="sub">Complaints</p><Text v={c.complaints} /><p className="sub">Diagnosis</p><Text v={c.diagnosis} /><p className="sub">Treatment notes</p><Text v={c.treatment_notes} />
      </Block>

      {d.labs.length > 0 && (
        <Block title="Laboratory">
          <table className="table"><thead><tr><th>Test</th><th>Result</th><th>Status</th><th>Requested by</th></tr></thead>
            <tbody>{d.labs.map((l) => <tr key={l.id}><td><b>{l.test_name}</b></td><td>{l.result || <span className="sub">Waiting</span>}</td><td><Pill value={l.status} /></td><td>{l.requested_by}</td></tr>)}</tbody></table>
        </Block>
      )}

      {d.prescriptions.length > 0 && (
        <Block title="Prescription">
          <table className="table"><thead><tr><th>Drug</th><th>Dosage</th><th>Duration</th><th>Qty</th><th>Status</th></tr></thead>
            <tbody>{d.prescriptions.map((r) => <tr key={r.id}><td><b>{r.drug}</b></td><td>{r.dosage}</td><td>{r.duration}</td><td>{r.quantity}</td><td><Pill value={r.status} /></td></tr>)}</tbody></table>
        </Block>
      )}

      <Block title="Bill">
        {d.charges.length === 0 ? <p className="sub">No charges yet. Set prices in the Price list so fees are added automatically.</p> : (
          <table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th><th>Added by</th></tr></thead>
            <tbody>{d.charges.map((x) => <tr key={x.id}><td>{x.description}</td><td>{x.quantity}</td><td>{ugx(x.unit_price)}</td><td><b>{ugx(x.amount)}</b></td><td className="sub">{x.added_by}</td></tr>)}</tbody></table>
        )}
        <dl className="totals">
          <div><dt>Consultation and registration</dt><dd>{ugx(t.registration + t.consultation)}</dd></div><div><dt>Laboratory</dt><dd>{ugx(t.lab)}</dd></div>
          <div><dt>Drugs</dt><dd>{ugx(t.drug + t.other)}</dd></div><div className="grand"><dt>Total</dt><dd>{ugx(t.total)}</dd></div>
          <div><dt>Paid</dt><dd>{ugx(t.paid)}</dd></div><div><dt>Balance</dt><dd>{ugx(t.balance)}</dd></div>
        </dl>
        {d.payments.length > 0 && <table className="table"><thead><tr><th>Receipt</th><th>When</th><th>Method</th><th>Amount</th><th>Received by</th></tr></thead>
          <tbody>{d.payments.map((p2) => <tr key={p2.id}><td><b>{p2.receipt_no}</b></td><td className="sub">{fmtStamp(p2.created_at)}</td><td>{label(p2.method)}</td><td>{ugx(p2.amount)}</td><td>{p2.received_by}</td></tr>)}</tbody></table>}
      </Block>

      <Block title="Who did what, and when">
        <ol className="timeline">{d.events.map((e) => (
          <li key={e.id}><span className="dot" /><div><b>{EVENT_LABEL[e.kind] || e.kind}</b>{e.details && <span className="sub"> · {e.details}</span>}
            <div className="sub">{e.user_name} ({e.role_label}) · {fmtStamp(e.created_at)}</div></div></li>))}</ol>
      </Block>
      {doc && <DocumentModal doc={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
