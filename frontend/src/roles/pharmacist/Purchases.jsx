import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import { Empty, Input, Modal, Notice, PageHead, Pill, Spinner, label, ugx } from "../../components/ui";

const STATUS = { ordered: ["amber", "Waiting for delivery"], partial: ["blue", "Part delivered"], received: ["green", "Received"], cancelled: ["gray", "Cancelled"] };
const today = () => new Date().toISOString().slice(0, 10);

// A request for medicines: which supplier, which medicines, how many, at what price.
function RequestModal({ suppliers, items, onClose, onDone }) {
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id || "", purchase_date: today(), notes: "" });
  const [lines, setLines] = useState([{ item_id: "", quantity: "", unit_cost: "" }]);
  const [err, setErr] = useState("");
  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post("/pharm/purchases", { ...f, supplier_id: Number(f.supplier_id), lines: lines.filter((l) => l.item_id).map((l) => ({ item_id: Number(l.item_id), quantity: Number(l.quantity), unit_cost: Number(l.unit_cost || 0) })) }); onDone("Purchase request saved. The clinic admin was told."); }
    catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title="Request medicines from a supplier" onClose={onClose} wide="xl">
      <form onSubmit={submit}>
        {suppliers.length === 0 && <Notice tone="error">Add a supplier first (the Suppliers tab).</Notice>}
        <div className="grid2">
          <Input label="Supplier"><select className="input" required value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Input>
          <Input label="Purchase date" type="date" value={f.purchase_date} onChange={(e) => setF({ ...f, purchase_date: e.target.value })} />
        </div>
        <table className="table"><thead><tr><th>Medicine</th><th>Quantity</th><th>Price per unit (UGX)</th><th>Amount</th><th /></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={i}><td><select className="input" value={l.item_id} onChange={(e) => { const it = items.find((x) => String(x.id) === e.target.value); setLine(i, { item_id: e.target.value, unit_cost: l.unit_cost || it?.purchase_price || "" }); }}><option value="">Choose…</option>{items.map((x) => <option key={x.id} value={x.id}>{x.name} {x.strength || ""} ({x.medicine_code})</option>)}</select></td>
              <td style={{ width: 110 }}><input className="input" type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Quantity" /></td>
              <td style={{ width: 150 }}><input className="input" type="number" min="0" step="any" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} aria-label="Price per unit" /></td>
              <td>{ugx((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}</td>
              <td>{lines.length > 1 && <button type="button" className="icon-btn" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={15} /></button>}</td></tr>))}</tbody></table>
        <button type="button" className="btn ghost sm" onClick={() => setLines([...lines, { item_id: "", quantity: "", unit_cost: "" }])}><Plus size={14} />Add another medicine</button>
        <Input full label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <p style={{ textAlign: "right", fontSize: 18 }}>Total: <b>{ugx(total)}</b></p>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.supplier_id || !lines.some((l) => l.item_id && Number(l.quantity) > 0)}>Save request</button></div>
      </form>
    </Modal>
  );
}

// Receiving a delivery: check each line against what was ordered, enter the batch number and the manufacturing and expiry dates, and the stock goes in.
function ReceiveModal({ purchase, onClose, onDone }) {
  const open = purchase.lines.filter((l) => l.qty_ordered - l.qty_received > 1e-9);
  const [rows, setRows] = useState(open.map((l) => ({ line_id: l.id, quantity: l.qty_ordered - l.qty_received, batch_no: "", mfg_date: "", expiry_date: "", selling_price: "", location: "" })));
  const [inv, setInv] = useState("");
  const [pay, setPay] = useState("no");
  const [err, setErr] = useState("");
  const set = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const cost = rows.reduce((s, r, i) => s + (Number(r.quantity) || 0) * open[i].unit_cost, 0);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post(`/pharm/purchases/${purchase.id}/receive`, { supplier_invoice: inv, pay_from_wallet: pay === "yes", lines: rows.map((r) => ({ ...r, quantity: Number(r.quantity) || 0, selling_price: r.selling_price === "" ? null : Number(r.selling_price), mfg_date: r.mfg_date || null, expiry_date: r.expiry_date || null })) }); onDone("Delivery received. Stock went up and every item was recorded; the clinic admin was told."); }
    catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Receive delivery · ${purchase.ref_no}`} onClose={onClose} wide="xl">
      <form onSubmit={submit}>
        <p className="sub">{purchase.supplier_name}. Check each medicine against the delivery note. Set a quantity to 0 for anything that did not arrive. Expired medicine cannot be received.</p>
        <div className="scroll"><table className="table"><thead><tr><th>Medicine</th><th>Ordered</th><th>Received now</th><th>Batch number</th><th>Manufactured</th><th>Expiry date</th><th>Selling price</th><th>Location</th></tr></thead>
          <tbody>{open.map((l, i) => (
            <tr key={l.id}><td><b>{l.item_name}</b><div className="sub">@ {ugx(l.unit_cost)}</div></td><td>{l.qty_ordered - l.qty_received}</td>
              <td style={{ width: 90 }}><input className="input" type="number" min="0" step="any" value={rows[i].quantity} onChange={set(i, "quantity")} aria-label="Quantity received" /></td>
              <td><input className="input" value={rows[i].batch_no} onChange={set(i, "batch_no")} aria-label="Batch number" /></td>
              <td><input className="input" type="date" value={rows[i].mfg_date} onChange={set(i, "mfg_date")} aria-label="Manufacturing date" /></td>
              <td><input className="input" type="date" required={Number(rows[i].quantity) > 0} value={rows[i].expiry_date} onChange={set(i, "expiry_date")} aria-label="Expiry date" /></td>
              <td style={{ width: 120 }}><input className="input" type="number" min="0" step="any" value={rows[i].selling_price} onChange={set(i, "selling_price")} aria-label="Selling price" /></td>
              <td><input className="input" value={rows[i].location} onChange={set(i, "location")} aria-label="Location" /></td></tr>))}</tbody></table></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <Input label="Supplier's invoice or delivery note number" value={inv} onChange={(e) => setInv(e.target.value)} />
          {cost > 0 && <Input label={`Pay ${ugx(cost)} from the clinic wallet?`}><select className="input" value={pay} onChange={(e) => setPay(e.target.value)}><option value="no">No, paid another way</option><option value="yes">Yes, take it from the wallet</option></select></Input>}
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Receive into stock</button></div>
      </form>
    </Modal>
  );
}

function SupplierModal({ s, onClose, onDone }) {
  const [f, setF] = useState({ name: s?.name || "", contact_person: s?.contact_person || "", phone: s?.phone || "", email: s?.email || "", address: s?.address || "", notes: s?.notes || "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { if (s) await api.patch(`/pharm/suppliers/${s.id}`, f); else await api.post("/pharm/suppliers", f); onDone(s ? "Supplier updated." : "Supplier added."); } catch (x) { setErr(errMsg(x)); } };
  return (
    <Modal title={s ? "Edit supplier" : "New supplier"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input full label="Supplier name" required value={f.name} onChange={set("name")} />
          <Input label="Contact person" value={f.contact_person} onChange={set("contact_person")} />
          <Input label="Phone number" type="tel" value={f.phone} onChange={set("phone")} />
          <Input label="Email" type="email" value={f.email} onChange={set("email")} />
          <Input label="Address" value={f.address} onChange={set("address")} />
          <Input full label="Notes" value={f.notes} onChange={set("notes")} />
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save supplier</button></div>
      </form>
    </Modal>
  );
}

export default function Purchases() {
  const { user } = useAuth();
  const [tab, setTab] = useState("purchases");
  const [pur, setPur] = useState(null);
  const [sup, setSup] = useState(null);
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => { api.get("/pharm/purchases").then((r) => setPur(r.data)).catch((e) => setErr(errMsg(e))); api.get("/pharm/suppliers").then((r) => setSup(r.data)).catch(() => {}); api.get("/stockroom").then((r) => setItems(r.data.items)).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const done = (m) => { setMsg(m); setModal(null); load(); };
  const cancel = async (p) => { setErr(""); try { await api.post(`/pharm/purchases/${p.id}/cancel`); load(); } catch (x) { setErr(errMsg(x)); } };
  const delSup = async (s) => { setErr(""); try { await api.delete(`/pharm/suppliers/${s.id}`); load(); } catch (x) { setErr(errMsg(x)); } };
  if (!pur || !sup) return err ? <Notice tone="error">{err}</Notice> : <Spinner />;
  return (
    <>
      <PageHead title="Purchases and suppliers" sub="Request medicines, receive the delivery (quantities and expiry dates are checked) and keep your supplier records. The clinic admin sees every request and delivery.">
        {tab === "purchases" ? <button className="btn primary" onClick={() => setModal({ type: "request" })}><Plus size={16} />Request medicines</button> : <button className="btn primary" onClick={() => setModal({ type: "supplier" })}><Plus size={16} />New supplier</button>}
      </PageHead>
      {msg && <Notice tone="success">{msg}</Notice>}{err && <Notice tone="error">{err}</Notice>}
      <div className="tabs" style={{ marginBottom: 12 }}><button className={tab === "purchases" ? "on" : ""} onClick={() => setTab("purchases")}>Purchases</button><button className={tab === "suppliers" ? "on" : ""} onClick={() => setTab("suppliers")}>Suppliers</button></div>
      <div className="panel">
        {tab === "purchases" ? (pur.length === 0 ? <Empty text="No purchase requests yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th>Medicines</th><th>Total</th><th>Status</th><th /></tr></thead>
            <tbody>{pur.map((p) => <tr key={p.id}><td><b>{p.ref_no}</b>{p.supplier_invoice && <div className="sub">Invoice {p.supplier_invoice}</div>}</td><td>{p.purchase_date}</td><td>{p.supplier_name}</td>
              <td>{p.lines.map((l) => `${l.item_name} ${l.qty_received}/${l.qty_ordered}`).join(", ")}</td><td>{ugx(p.total)}</td><td><Pill tone={STATUS[p.status][0]}>{STATUS[p.status][1]}</Pill></td>
              <td className="row-actions">{["ordered", "partial"].includes(p.status) && <button className="btn primary sm" onClick={() => setModal({ type: "receive", p })}>Receive delivery</button>}{p.status === "ordered" && <button className="btn ghost sm" onClick={() => cancel(p)}>Cancel</button>}</td></tr>)}</tbody></table></div>))
          : (sup.length === 0 ? <Empty text="No suppliers yet." /> : (
            <div className="scroll"><table className="table"><thead><tr><th>Supplier</th><th>Contact person</th><th>Phone</th><th>Email</th><th>Address</th><th>Purchases</th><th /></tr></thead>
              <tbody>{sup.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.contact_person || "-"}</td><td>{s.phone || "-"}</td><td>{s.email || "-"}</td><td>{s.address || "-"}</td><td>{s.purchases} ({ugx(s.total)})</td>
                <td className="row-actions"><button className="btn ghost sm" onClick={() => setModal({ type: "supplier", s })}>Edit</button><button className="btn ghost sm" onClick={() => delSup(s)}>Delete</button></td></tr>)}</tbody></table></div>))}
      </div>
      {modal?.type === "request" && <RequestModal suppliers={sup} items={items} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === "receive" && <ReceiveModal purchase={modal.p} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === "supplier" && <SupplierModal s={modal.s} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}
