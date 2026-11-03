import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Input, Modal, Notice, Spinner, ugx } from "../ui";

export function AddBatchModal({ product, onClose, onDone }) {
  const [f, setF] = useState({ batch_no: "", expiry_date: "", quantity: "", cost_price: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post(`/pharmacy/products/${product.id}/batches`, { ...f, quantity: Number(f.quantity), cost_price: Number(f.cost_price || 0) }); onDone(); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Add stock · ${product.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input label={`Quantity (${product.unit || "units"})`} type="number" min="0" step="any" value={f.quantity} onChange={set("quantity")} required />
          <Input label="Cost price per unit (UGX)" type="number" min="0" step="any" value={f.cost_price} onChange={set("cost_price")} />
          <Input label="Batch number" value={f.batch_no} onChange={set("batch_no")} />
          <Input label="Expiry date" type="date" value={f.expiry_date} onChange={set("expiry_date")} />
        </div>
        <Notice>For stock that came from a supplier, use Purchases so the cost and supplier are recorded. This is for opening stock and corrections.</Notice>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Add to stock</button></div>
      </form>
    </Modal>
  );
}

export function BatchesModal({ product, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.get(`/pharmacy/products/${product.id}/batches`).then((r) => setRows(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const today = new Date().toISOString().slice(0, 10);
  const adjust = async (b) => {
    const q = window.prompt(`Counted quantity for batch ${b.batch_no || "(no number)"}? Now ${b.quantity}.`, String(b.quantity));
    if (q === null || q === "" || Number.isNaN(Number(q)) || Number(q) < 0) return;
    const reason = window.prompt("Why is it being changed? (for example: stock count, breakage, expired)", "Stock count");
    if (!reason || reason.trim().length < 3) return;
    try { await api.post(`/pharmacy/batches/${b.id}/adjust`, { quantity: Number(q), reason }); await load(); onChanged(); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Batches · ${product.name}`} onClose={onClose} wide>
      {err && <Notice tone="error">{err}</Notice>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty text="No stock batches yet." /> : (
        <table className="table"><thead><tr><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Cost price</th><th /></tr></thead>
          <tbody>{rows.map((b) => (
            <tr key={b.id}><td><b>{b.batch_no || "-"}</b></td>
              <td style={{ color: b.expiry_date && b.expiry_date < today ? "var(--coral)" : undefined }}>{b.expiry_date || "-"}{b.expiry_date && b.expiry_date < today && " (expired)"}</td>
              <td>{b.quantity}</td><td>{ugx(b.cost_price)}</td><td className="row-actions"><button className="btn ghost sm" onClick={() => adjust(b)}>Correct quantity</button></td></tr>))}</tbody></table>
      )}
    </Modal>
  );
}
