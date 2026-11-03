import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice, ugx } from "../ui";

const blankLine = { product_id: "", batch_no: "", expiry_date: "", quantity: "", unit_cost: "" };

export default function ReceivePurchaseModal({ onClose, onDone }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [f, setF] = useState({ supplier_id: "", supplier_invoice: "", notes: "", pay_from_wallet: "yes" });
  const [lines, setLines] = useState([{ ...blankLine }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/pharmacy/stock").then((r) => setProducts(r.data)); api.get("/suppliers").then((r) => setSuppliers(r.data)); }, []);
  const upd = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
  const total = valid.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost || 0), 0);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.post("/pharmacy/purchases", { supplier_id: f.supplier_id ? Number(f.supplier_id) : null, supplier_invoice: f.supplier_invoice || null, notes: f.notes || null, pay_from_wallet: f.pay_from_wallet === "yes",
        lines: valid.map((l) => ({ product_id: Number(l.product_id), batch_no: l.batch_no || null, expiry_date: l.expiry_date || null, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost || 0) })) });
      onDone();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Receive stock from a supplier" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input label="Supplier"><select className="input" value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">No supplier recorded</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Input>
          <Input label="Supplier's invoice number" value={f.supplier_invoice} onChange={(e) => setF({ ...f, supplier_invoice: e.target.value })} />
        </div>
        <p className="group-title">Items received</p>
        {lines.map((l, i) => (
          <div className="line pline" key={i}>
            <select className="input" style={{ flex: "2 1 200px" }} value={l.product_id} onChange={(e) => upd(i, "product_id", e.target.value)}><option value="">Choose a product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input className="input" placeholder="Batch no." value={l.batch_no} onChange={(e) => upd(i, "batch_no", e.target.value)} />
            <input className="input" type="date" title="Expiry date" value={l.expiry_date} onChange={(e) => upd(i, "expiry_date", e.target.value)} />
            <input className="input" type="number" min="0" step="any" placeholder="Qty" value={l.quantity} onChange={(e) => upd(i, "quantity", e.target.value)} />
            <input className="input" type="number" min="0" step="any" placeholder="Unit cost" value={l.unit_cost} onChange={(e) => upd(i, "unit_cost", e.target.value)} />
          </div>))}
        <button type="button" className="btn ghost sm" onClick={() => setLines([...lines, { ...blankLine }])}>+ Add another item</button>
        <div className="grid2" style={{ marginTop: 16 }}>
          <Input label="Pay the supplier from the pharmacy wallet?"><select className="input" value={f.pay_from_wallet} onChange={(e) => setF({ ...f, pay_from_wallet: e.target.value })}><option value="yes">Yes, take {ugx(total)} from the wallet</option><option value="no">No, paid another way</option></select></Input>
          <Input label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || valid.length === 0}>{busy ? "Saving…" : `Receive stock (${ugx(total)})`}</button></div>
      </form>
    </Modal>
  );
}
