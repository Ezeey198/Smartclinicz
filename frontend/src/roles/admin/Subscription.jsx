import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import PaymentWaiting from "../../components/PaymentWaiting";
import TopUpModal from "../../components/TopUpModal";
import { Empty, Input, Modal, Notice, PageHead, Pill, Spinner, fmtLeft, fmtStamp, label, ugx } from "../../components/ui";

export default function Subscription() {
  const { refresh } = useAuth();
  const [d, setD] = useState(null);
  const [method, setMethod] = useState("mobile_money");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(false);
  const [opt, setOpt] = useState(null);
  const [network, setNetwork] = useState("");
  const [waiting, setWaiting] = useState(null);
  const [, tick] = useState(0);
  const load = () => api.get("/subscription").then((r) => setD(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { api.get("/wallet/options").then((r) => { setOpt(r.data); setNetwork(r.data.networks[0]?.id || ""); }); load(); const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  if (!d) return <Spinner />;

  const left = d.active_until ? Math.max(0, Math.floor((Date.parse(d.active_until) - Date.now()) / 1000)) : 0;
  const active = d.state === "active" && left > 0;
  const pay = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const { data } = await api.post("/subscription/pay", { method, network, phone });
      if (data.status === "pending") { setWaiting(data.request_id); return; }
      setD(data);
      await refresh();
      setMsg({ tone: "success", text: `Paid ${ugx(d.price)}. The clinic is active for another ${d.period_hours} hours.` });
    } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Subscription" sub={`${ugx(d.price)} keeps the clinic active for ${d.period_hours} hours. New clinics get ${d.trial_hours} free hours after approval.`} />
      <div className="strip">
        <div className="strip-item"><b>{active ? fmtLeft(left) : "Inactive"}</b><span>{active ? (d.trial ? "Free trial time left" : "Time left") : "Staff cannot sign in"}</span></div>
        <div className="strip-item"><b>{d.active_until ? fmtStamp(d.active_until) : "-"}</b><span>{active ? "Active until" : "Ended"}</span></div>
        <div className="strip-item"><b>{ugx(d.wallet_balance)}</b><span>Clinic wallet</span></div>
      </div>
      {msg && <div style={{ marginTop: 16 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="panel pad narrow" style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 12 }}>{active ? "Add another day" : `Renew for ${ugx(d.price)}`}</h3>
        <form onSubmit={pay}>
          <Input label="Pay with"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="mobile_money">Mobile money</option>{opt?.card && <option value="card">Card (demo)</option>}
            <option value="wallet" disabled={d.wallet_balance < d.price}>Clinic wallet ({ugx(d.wallet_balance)})</option></select></Input>
          {method === "mobile_money" && (
            <>
              <Input label="Network"><select className="input" value={network} onChange={(e) => setNetwork(e.target.value)} required>
                {(opt?.networks || []).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Input>
              <Input label="Mobile money number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" required />
            </>
          )}
          <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Paying…" : `Pay ${ugx(d.price)}`}</button>
            <button type="button" className="btn ghost" onClick={() => setTop(true)}>Top up wallet</button></div>
          <p className="hint">{opt?.live ? "A payment request is sent to your phone. The clinic is activated only after you approve it." : "Demo mode: payments are simulated and no real money moves."}</p>
        </form>
      </div>
      <h3 className="section">Payment history</h3>
      <div className="panel">
        {d.history.length === 0 ? <Empty text="No subscription payments yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Paid</th><th>Amount</th><th>Method</th><th>Covers</th><th>Paid by</th></tr></thead>
            <tbody>{d.history.map((p) => <tr key={p.id}><td className="sub">{fmtStamp(p.created_at)}</td><td><b>{ugx(p.amount)}</b></td>
              <td><Pill tone="blue">{label(p.method)}</Pill>{p.reference && <div className="sub">Ref {p.reference}</div>}</td>
              <td className="sub">{fmtStamp(p.period_start)} to {fmtStamp(p.period_end)}</td><td>{p.paid_by}</td></tr>)}</tbody></table></div>
        )}
      </div>
      {waiting && (
        <Modal title="Waiting for payment" onClose={() => setWaiting(null)}>
          <PaymentWaiting requestId={waiting}
            onSuccess={async () => { setWaiting(null); await refresh(); load(); setMsg({ tone: "success", text: `Payment received. The clinic is active for another ${d.period_hours} hours.` }); }}
            onFail={(r) => { setWaiting(null); setMsg({ tone: "error", text: r }); }} />
        </Modal>
      )}
      {top && <TopUpModal onClose={() => setTop(false)} onDone={() => { setTop(false); load(); }} />}
    </>
  );
}
