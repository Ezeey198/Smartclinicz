import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import ReturnModal from "../../components/pharm/ReturnModal";
import { Empty, Input, Modal, Notice, PageHead, Pill, Spinner, fmtStamp, label, ugx } from "../../components/ui";

const STATUS = { awaiting_approval: ["amber", "Waiting for the admin"], approved: ["green", "Approved"], rejected: ["coral", "Rejected"] };
const INSPECT = { good: ["green", "Passed inspection"], damaged: ["coral", "Damaged"], expired: ["coral", "Expired"] };

// Returned medicines (they re-enter stock only after inspection and the admin's approval) and the records of expired and damaged medicines.
export default function Returns() {
  const { user } = useAuth();
  const isAdmin = user.roles?.includes("admin");
  const [tab, setTab] = useState("returns");
  const [rets, setRets] = useState(null);
  const [disp, setDisp] = useState(null);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => { api.get("/pharm/returns").then((r) => setRets(r.data)).catch((e) => setErr(errMsg(e))); api.get("/pharm/disposals").then((r) => setDisp(r.data)).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const decide = async (r, ok) => {
    setErr("");
    try { await api.post(`/pharm/returns/${r.id}/${ok ? "approve" : "reject"}`, { note }); setNote(""); setModal(null); setMsg(ok ? `${r.ref_no} approved.` : `${r.ref_no} rejected.`); load(); } catch (x) { setErr(errMsg(x)); }
  };
  if (!rets || !disp) return err ? <Notice tone="error">{err}</Notice> : <Spinner />;
  const pending = rets.filter((r) => r.status === "awaiting_approval").length;
  return (
    <>
      <PageHead title="Returns, refunds and expired medicines" sub="A returned medicine goes back into stock only after inspection and the clinic admin's approval. Expired and damaged medicine is removed from stock and recorded here.">
        <button className="btn primary" onClick={() => setModal({ type: "return" })}><Plus size={16} />Record a return</button>
      </PageHead>
      {msg && <Notice tone="success">{msg}</Notice>}{err && <Notice tone="error">{err}</Notice>}
      {isAdmin && pending > 0 && <Notice>{pending} return{pending > 1 ? "s are" : " is"} waiting for your approval.</Notice>}
      <div className="tabs" style={{ marginBottom: 12 }}><button className={tab === "returns" ? "on" : ""} onClick={() => setTab("returns")}>Returns and refunds{pending > 0 ? ` (${pending})` : ""}</button><button className={tab === "disposals" ? "on" : ""} onClick={() => setTab("disposals")}>Expired and damaged</button></div>
      <div className="panel">
        {tab === "returns" ? (rets.length === 0 ? <Empty text="No returns recorded yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Return</th><th>Medicine</th><th>Qty</th><th>Reason</th><th>Inspection</th><th>Refund</th><th>Status</th><th /></tr></thead>
            <tbody>{rets.map((r) => <tr key={r.id}><td><b>{r.ref_no}</b><div className="sub">{fmtStamp(r.created_at)}{r.customer_name ? ` · ${r.customer_name}` : ""}</div></td><td>{r.item_name}<div className="sub">{r.stock_no || ""}</div></td><td>{r.quantity}</td><td>{r.reason}</td>
              <td><Pill tone={INSPECT[r.inspection][0]}>{INSPECT[r.inspection][1]}</Pill>{r.inspection_note && <div className="sub">{r.inspection_note}</div>}</td><td>{r.refund_amount ? `${ugx(r.refund_amount)} (${label(r.refund_method)})` : "-"}</td>
              <td><Pill tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Pill>{r.decision_note && <div className="sub">{r.decision_note}</div>}</td>
              <td className="row-actions">{isAdmin && r.status === "awaiting_approval" && <button className="btn primary sm" onClick={() => { setNote(""); setModal({ type: "decide", r }); }}>Review</button>}</td></tr>)}</tbody></table></div>))
          : (disp.length === 0 ? <Empty text="Nothing has been removed from stock yet. Use Remove on a batch in Stock." /> : (
            <div className="scroll"><table className="table"><thead><tr><th>Record</th><th>When</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expiry</th><th>Reason</th><th>Disposal</th></tr></thead>
              <tbody>{disp.map((d) => <tr key={d.id}><td><b>{d.ref_no}</b></td><td>{fmtStamp(d.created_at)}</td><td>{d.item_name}</td><td>{d.stock_no} {d.batch_no}</td><td>{d.quantity}</td><td>{d.expiry_date || "-"}</td><td><Pill tone="coral">{label(d.reason)}</Pill></td><td>{d.method}{d.notes && <div className="sub">{d.notes}</div>}</td></tr>)}</tbody></table></div>))}
      </div>
      {modal?.type === "return" && <ReturnModal onClose={() => setModal(null)} onDone={(m) => { setModal(null); setMsg(m); load(); }} />}
      {modal?.type === "decide" && (
        <Modal title={`Review ${modal.r.ref_no}`} onClose={() => setModal(null)}>
          <p><b>{modal.r.quantity} {modal.r.item_name}</b> returned. Reason: {modal.r.reason}.</p>
          <p className="sub">Inspection result: <b>{INSPECT[modal.r.inspection][1]}</b>{modal.r.inspection === "good" ? `. Approving puts it back into ${modal.r.stock_no}.` : ". Approving records it as removed; it does not go back into stock."} {modal.r.refund_amount ? `A refund of ${ugx(modal.r.refund_amount)} will be paid out of the clinic wallet.` : ""}</p>
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="modal-foot"><button className="btn ghost" onClick={() => decide(modal.r, false)}>Reject</button><button className="btn primary" onClick={() => decide(modal.r, true)}>Approve</button></div>
        </Modal>)}
    </>
  );
}
