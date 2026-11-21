import { useEffect, useState } from "react";
import { Power, PowerOff } from "lucide-react";
import api, { errMsg } from "../../api";
import { Band, Empty, Input, Modal, Notice, PageHead, Pill, Spinner, fmtLeft, fmtStamp, label, ugx } from "../../components/ui";

const TONE = { active: "green", expired: "coral", pending: "gray", suspended: "coral" };
const stateText = (c) => {
  const s = c.subscription;
  if (c.status === "suspended") return "Deactivated";
  if (s.state === "active") return c.last_method === "granted_by_admin" ? "Active (granted)" : s.trial ? "Free trial" : "Subscribed";
  return s.state === "expired" ? "Inactive, awaiting payment" : label(s.state);
};

export default function Subscriptions() {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [grant, setGrant] = useState(null);
  const [days, setDays] = useState(1);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState("");
  const [, tick] = useState(0);
  const load = () => api.get("/superadmin/subscriptions").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const open = (c) => api.get(`/superadmin/subscriptions/${c.id}`).then((r) => setSel({ ...r.data, row: c }));

  const doActivate = async () => {
    try { await api.post(`/superadmin/subscriptions/${grant.id}/activate`, { days: Number(days) }); setMsg({ tone: "success", text: `${grant.name} is active for ${days} more day(s). No payment was taken.` }); setGrant(null); setSel(null); load(); }
    catch (x) { setMsg({ tone: "error", text: errMsg(x) }); }
  };
  const doDeactivate = async (c) => {
    if (!window.confirm(`Deactivate ${c.name}? Its staff and admin cannot sign in or renew until you activate it again.`)) return;
    try { await api.post(`/superadmin/subscriptions/${c.id}/deactivate`); setMsg({ tone: "success", text: `${c.name} is deactivated.` }); setSel(null); load(); }
    catch (x) { setMsg({ tone: "error", text: errMsg(x) }); }
  };

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <Spinner />;
  const s = d.summary;
  const left = (c) => (c.subscription.active_until ? Math.max(0, Math.floor((Date.parse(c.subscription.active_until) - Date.now()) / 1000)) : 0);
  const Actions = ({ c }) => (
    <div className="row" onClick={(e) => e.stopPropagation()}>
      <button className="btn primary sm" onClick={() => { setDays(1); setGrant(c); }}><Power size={13} /> {c.subscription.state === "active" && c.status !== "suspended" ? "Add time" : "Activate"}</button>
      {c.status !== "suspended" && <button className="btn danger sm" onClick={() => doDeactivate(c)}><PowerOff size={13} /> Deactivate</button>}
    </div>
  );

  return (
    <>
      <PageHead title="Subscriptions" sub="Track every clinic's subscription, and switch a clinic on or off whether or not it has subscribed." />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="strip">{[["Active now", s.active], ["On free trial", s.on_trial], ["Inactive (unpaid)", s.expired], ["Deactivated", s.deactivated], ["Payments received", s.payments], ["Subscription income", ugx(s.revenue)]]
        .map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      <div className="panel" style={{ marginTop: 18 }}>
        {d.clinics.length === 0 ? <Empty text="No clinics yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Clinic</th><th>Code</th><th>Status</th><th>Time left</th><th>Payments</th><th>Total paid</th><th>Last payment</th><th /></tr></thead>
            <tbody>{d.clinics.map((c) => (
              <tr key={c.id} className="click" onClick={() => open(c)}>
                <td><b>{c.name}</b><div className="sub">{c.admin?.full_name}</div></td><td><Band code={c.code} cls={c.clinic_class} /></td>
                <td><Pill tone={c.status === "suspended" ? "coral" : TONE[c.subscription.state] || "gray"}>{stateText(c)}</Pill>{!c.approved && c.status !== "suspended" && <div className="sub">Not approved by the admin yet</div>}</td>
                <td>{c.subscription.state === "active" && c.status !== "suspended" ? fmtLeft(left(c)) : "-"}</td><td>{c.payments}</td><td>{ugx(c.total_paid)}</td><td className="sub">{fmtStamp(c.last_payment) || "-"}</td>
                <td className="row-actions"><Actions c={c} /></td>
              </tr>))}</tbody></table></div>
        )}
      </div>

      {grant && (
        <Modal title={`Activate ${grant.name}`} onClose={() => setGrant(null)}>
          <Input label="Keep the clinic active for"><select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></Input>
          <Notice>No payment is taken. This works before the clinic subscribes or after, and it is recorded in the subscription history as granted by you.{!grant.approved && " The clinic has not been approved by its admin yet, so this also approves it."}</Notice>
          <div className="modal-foot"><button className="btn ghost" onClick={() => setGrant(null)}>Cancel</button><button className="btn primary" onClick={doActivate}>Activate</button></div>
        </Modal>
      )}

      {sel && (
        <Modal title={sel.clinic.name} onClose={() => setSel(null)} wide>
          <div className="detail-top"><Band code={sel.clinic.code} cls={sel.clinic.clinic_class} size="lg" /><Pill tone={sel.status === "suspended" ? "coral" : TONE[sel.subscription.state] || "gray"}>{stateText({ ...sel.row, subscription: sel.subscription, status: sel.status })}</Pill>
            {sel.subscription.active_until && <span className="sub">{sel.subscription.state === "active" ? "Active until" : "Ended"} {fmtStamp(sel.subscription.active_until)}</span>}</div>
          <div style={{ margin: "10px 0 14px" }}><Actions c={{ ...sel.row, status: sel.status, subscription: sel.subscription }} /></div>
          {sel.payments.length === 0 ? <Empty text="No subscription payments yet." /> : (
            <table className="table"><thead><tr><th>When</th><th>Amount</th><th>Method</th><th>Covers</th><th>By</th></tr></thead>
              <tbody>{sel.payments.map((p) => <tr key={p.id}><td className="sub">{fmtStamp(p.created_at)}</td><td><b>{p.method === "granted_by_admin" ? "No charge" : ugx(p.amount)}</b></td><td>{p.method === "granted_by_admin" ? "Granted by superadmin" : label(p.method)}<div className="sub">{p.reference}</div></td>
                <td className="sub">{fmtStamp(p.period_start)} to {fmtStamp(p.period_end)}</td><td>{p.paid_by}</td></tr>)}</tbody></table>
          )}
        </Modal>
      )}
    </>
  );
}
