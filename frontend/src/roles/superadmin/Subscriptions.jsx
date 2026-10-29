import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Band, Empty, Modal, Notice, PageHead, Pill, Spinner, fmtLeft, fmtStamp, label, ugx } from "../../components/ui";

const TONE = { active: "green", expired: "coral", pending: "gray", suspended: "coral" };
const stateText = (s) => (s.state === "active" ? (s.trial ? "Free trial" : "Subscribed") : s.state === "expired" ? "Inactive, awaiting payment" : label(s.state));

export default function Subscriptions() {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState("");
  const [, tick] = useState(0);
  useEffect(() => { api.get("/superadmin/subscriptions").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const open = (c) => api.get(`/superadmin/subscriptions/${c.id}`).then((r) => setSel(r.data));
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <Spinner />;
  const s = d.summary;
  const left = (c) => (c.subscription.active_until ? Math.max(0, Math.floor((Date.parse(c.subscription.active_until) - Date.now()) / 1000)) : 0);
  return (
    <>
      <PageHead title="Subscriptions" sub="Tracking only. Each clinic admin pays for their own clinic." />
      <div className="strip">{[["Active now", s.active], ["On free trial", s.on_trial], ["Inactive (unpaid)", s.expired], ["Payments received", s.payments], ["Subscription income", ugx(s.revenue)]]
        .map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      <div className="panel" style={{ marginTop: 18 }}>
        {d.clinics.length === 0 ? <Empty text="No clinics yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Clinic</th><th>Code</th><th>Status</th><th>Time left</th><th>Payments</th><th>Total paid</th><th>Last payment</th></tr></thead>
            <tbody>{d.clinics.map((c) => (
              <tr key={c.id} className="click" onClick={() => open(c)}>
                <td><b>{c.name}</b><div className="sub">{c.admin?.full_name}</div></td><td><Band code={c.code} cls={c.clinic_class} /></td>
                <td><Pill tone={TONE[c.subscription.state] || "gray"}>{stateText(c.subscription)}</Pill></td>
                <td>{c.subscription.state === "active" ? fmtLeft(left(c)) : "-"}</td><td>{c.payments}</td><td>{ugx(c.total_paid)}</td><td className="sub">{fmtStamp(c.last_payment) || "-"}</td>
              </tr>))}</tbody></table></div>
        )}
      </div>
      {sel && (
        <Modal title={sel.clinic.name} onClose={() => setSel(null)} wide>
          <div className="detail-top"><Band code={sel.clinic.code} cls={sel.clinic.clinic_class} size="lg" /><Pill tone={TONE[sel.subscription.state] || "gray"}>{stateText(sel.subscription)}</Pill>
            {sel.subscription.active_until && <span className="sub">{sel.subscription.state === "active" ? "Active until" : "Ended"} {fmtStamp(sel.subscription.active_until)}</span>}</div>
          {sel.payments.length === 0 ? <Empty text="No subscription payments yet." /> : (
            <table className="table"><thead><tr><th>Paid</th><th>Amount</th><th>Method</th><th>Covers</th><th>Paid by</th></tr></thead>
              <tbody>{sel.payments.map((p) => <tr key={p.id}><td className="sub">{fmtStamp(p.created_at)}</td><td><b>{ugx(p.amount)}</b></td><td>{label(p.method)}<div className="sub">{p.reference}</div></td>
                <td className="sub">{fmtStamp(p.period_start)} to {fmtStamp(p.period_end)}</td><td>{p.paid_by}</td></tr>)}</tbody></table>
          )}
        </Modal>
      )}
    </>
  );
}
