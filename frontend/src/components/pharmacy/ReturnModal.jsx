import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice, ugx } from "../ui";

// A medicine brought back. It is inspected here, but it only goes back into stock (and any refund is only paid) once the clinic admin approves.
export default function ReturnModal({ sale = null, onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ item_id: sale ? sale.lines[0].item_id : "", batch_id: "", quantity: "", reason: "", source: sale ? "walk-in sale" : "patient dispensing", customer_name: sale ? sale.customer_name : "", refund_amount: "", refund_method: "cash", inspection: "good", inspection_note: "" });
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/stockroom").then((r) => setItems(r.data.items)).catch((e) => setErr(errMsg(e))); }, []);
  const item = items.find((i) => String(i.id) === String(f.item_id));
  const line = sale && sale.lines.find((l) => String(l.item_id) === String(f.item_id));
  const pool = sale ? items.filter((i) => sale.lines.some((l) => l.item_id === i.id)) : items.filter((i) => !q.trim() || `${i.name} ${i.medicine_code}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const suggested = line && f.quantity ? Number(f.quantity) * line.unit_price : null;
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.post("/pharm/returns", { item_id: Number(f.item_id), batch_id: f.batch_id ? Number(f.batch_id) : null, quantity: Number(f.quantity), reason: f.reason, source: f.source, sale_id: sale ? sale.id : null,
        customer_name: f.customer_name, refund_amount: f.refund_amount === "" ? 0 : Number(f.refund_amount), refund_method: Number(f.refund_amount) > 0 ? f.refund_method : null, inspection: f.inspection, inspection_note: f.inspection_note });
      onDone("Return recorded. It re-enters stock, and any refund is paid, only after the clinic admin approves it.");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title={sale ? `Return items · ${sale.receipt_no}` : "Record a returned medicine"} onClose={onClose} wide>
      <form onSubmit={submit}>
        {!sale && <Input label="Find the medicine" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or Medicine ID" />}
        <div className="grid2">
          <Input label="Medicine"><select className="input" required value={f.item_id} onChange={(e) => setF({ ...f, item_id: e.target.value, batch_id: "" })}><option value="">Choose…</option>{pool.map((i) => <option key={i.id} value={i.id}>{i.name} {i.strength || ""} ({i.medicine_code})</option>)}</select></Input>
          <Input label="Batch it came from" hint="Needed for a medicine that passes inspection.">
            <select className="input" value={f.batch_id} onChange={set("batch_id")}><option value="">Not known</option>{(item?.batches || []).map((b) => <option key={b.id} value={b.id}>{b.stock_no} · batch {b.batch_no || "-"} · exp {b.expiry_date || "-"}</option>)}</select></Input>
          <Input label={`Quantity returned${line ? ` (sold: ${line.quantity})` : ""}`} type="number" min="0" step="any" required value={f.quantity} onChange={set("quantity")} />
          <Input label="Returned from"><select className="input" value={f.source} onChange={set("source")}><option value="walk-in sale">A walk-in sale</option><option value="patient dispensing">Dispensed to a patient</option><option value="other">Other</option></select></Input>
          <Input full label="Reason for the return" required minLength={3} value={f.reason} onChange={set("reason")} />
          <Input label="Customer or patient name" value={f.customer_name} onChange={set("customer_name")} />
          <Input label={`Refund (UGX), if any${suggested ? ` — paid for these: ${ugx(suggested)}` : ""}`} type="number" min="0" step="any" value={f.refund_amount} onChange={set("refund_amount")} />
          {Number(f.refund_amount) > 0 && <Input label="Refund paid by"><select className="input" value={f.refund_method} onChange={set("refund_method")}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select></Input>}
          <Input label="Inspection result"><select className="input" value={f.inspection} onChange={set("inspection")}><option value="good">Good: sealed, in date, fit to sell again</option><option value="damaged">Damaged: not fit to sell</option><option value="expired">Expired</option></select></Input>
          <Input label="Inspection notes" value={f.inspection_note} onChange={set("inspection_note")} />
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !f.item_id || !f.quantity || f.reason.trim().length < 3}>{busy ? "Saving…" : "Record return"}</button></div>
      </form>
    </Modal>
  );
}
