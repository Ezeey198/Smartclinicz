import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import DocumentModal from "../../components/DocumentModal";
import ReturnModal from "../../components/pharm/ReturnModal";
import { DOCS } from "../../config/documents";
import { Empty, Input, Notice, PageHead, Pill, Spinner, fmtStamp, label, ugx } from "../../components/ui";

const today = () => new Date().toISOString().slice(0, 10);

// Walk-in sales of over-the-counter medicines and supplies to people who are not registered clinic patients. It uses the same stock as patient dispensing,
// never sells prescription-only or expired medicine, and every sale gets a receipt. The clinic admin sees every sale.
export default function Sales() {
  const { user } = useAuth();
  const isAdmin = user.roles?.includes("admin");
  const [tab, setTab] = useState("new");
  const [stock, setStock] = useState(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [cust, setCust] = useState({ customer_name: "", customer_phone: "" });
  const [pay, setPay] = useState({ payment_method: "cash", payment_ref: "", amount_paid: "", discount: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [recs, setRecs] = useState(null);
  const [range, setRange] = useState({ start: today(), end: today() });
  const [ret, setRet] = useState(null);
  const [msg, setMsg] = useState("");
  const loadStock = () => api.get("/pharm/sellable").then((r) => setStock(r.data)).catch((e) => setErr(errMsg(e)));
  const loadRecs = () => api.get("/pharm/sales", { params: range }).then((r) => setRecs(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { loadStock(); }, []);
  useEffect(() => { if (tab === "records") loadRecs(); }, [tab, range.start, range.end]);

  const matches = useMemo(() => (stock || []).filter((i) => !q.trim() || `${i.name} ${i.medicine_code} ${i.strength || ""} ${i.category || ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 14), [stock, q]);
  const add = (i) => setCart((c) => (c.some((x) => x.item_id === i.id) ? c : [...c, { item_id: i.id, name: i.name, strength: i.strength, unit: i.unit, available: i.available, price: i.price, quantity: 1 }]));
  const setLine = (id, patch) => setCart((c) => c.map((x) => (x.item_id === id ? { ...x, ...patch } : x)));
  const subtotal = cart.reduce((s, x) => s + (Number(x.quantity) || 0) * (Number(x.price) || 0), 0);
  const discount = Number(pay.discount) || 0;
  const total = Math.max(0, subtotal - discount);
  const paid = pay.payment_method === "cash" ? (pay.amount_paid === "" ? total : Number(pay.amount_paid)) : total;
  const change = Math.max(0, paid - total);

  const complete = async () => {
    setErr(""); setBusy(true);
    try {
      const { data } = await api.post("/pharm/sales", { ...cust, lines: cart.map((x) => ({ item_id: x.item_id, quantity: Number(x.quantity), unit_price: isAdmin ? Number(x.price) : null })), discount,
        payment_method: pay.payment_method, payment_ref: pay.payment_ref, amount_paid: pay.payment_method === "cash" && pay.amount_paid !== "" ? Number(pay.amount_paid) : null });
      setReceipt(data); setCart([]); setCust({ customer_name: "", customer_phone: "" }); setPay({ payment_method: "cash", payment_ref: "", amount_paid: "", discount: "" }); loadStock();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  if (!stock) return err ? <Notice tone="error">{err}</Notice> : <Spinner />;
  return (
    <>
      <PageHead title="Walk-in sales" sub="Sell over-the-counter medicines and supplies to people who are not clinic patients. Stock goes down automatically and every sale has a receipt." />
      {msg && <Notice tone="success">{msg}</Notice>}
      <div className="tabs" style={{ marginBottom: 12 }}><button className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>New sale</button><button className={tab === "records" ? "on" : ""} onClick={() => setTab("records")}>Sales records</button></div>
      {tab === "new" ? (
        <div className="sale-grid">
          <div className="panel pad">
            <Input label="Find a medicine or item" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, strength or Medicine ID" />
            <div className="sale-list">
              {matches.length === 0 && <p className="sub">Nothing matches.</p>}
              {matches.map((i) => {
                const blocked = i.prescription_only ? "Prescription-only" : i.available <= 0 ? "No unexpired stock" : i.price <= 0 ? "No selling price" : "";
                return (
                  <button key={i.id} disabled={!!blocked} onClick={() => add(i)} className="sale-item" title={blocked || "Add to the sale"}>
                    <span><b>{i.name}</b> <span className="sub">{[i.strength, i.dosage_form].filter(Boolean).join(" ")}</span><small>{i.medicine_code} · {i.available} {i.unit || ""} available</small></span>
                    <span>{blocked ? <Pill tone="amber">{blocked}</Pill> : <><b>{ugx(i.price)}</b> <Plus size={14} /></>}</span>
                  </button>);
              })}
            </div>
          </div>
          <div className="panel pad">
            <h3 style={{ marginBottom: 8 }}>This sale</h3>
            {cart.length === 0 ? <p className="sub">Choose medicines on the left.</p> : (
              <table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th><th /></tr></thead>
                <tbody>{cart.map((x) => (
                  <tr key={x.item_id}><td><b>{x.name}</b> <span className="sub">{x.strength}</span><div className="sub">{x.available} available</div></td>
                    <td style={{ width: 90 }}><input className="input" type="number" min="0" step="any" value={x.quantity} onChange={(e) => setLine(x.item_id, { quantity: e.target.value })} aria-label={`Quantity of ${x.name}`} /></td>
                    <td style={{ width: 110 }}>{isAdmin ? <input className="input" type="number" min="0" step="any" value={x.price} onChange={(e) => setLine(x.item_id, { price: e.target.value })} aria-label={`Price of ${x.name}`} /> : ugx(x.price)}</td>
                    <td>{ugx((Number(x.quantity) || 0) * (Number(x.price) || 0))}</td>
                    <td><button className="icon-btn" onClick={() => setCart(cart.filter((c) => c.item_id !== x.item_id))} aria-label="Remove"><Trash2 size={15} /></button></td></tr>))}</tbody></table>)}
            <div className="grid2" style={{ marginTop: 10 }}>
              <Input label="Customer name (optional)" value={cust.customer_name} onChange={(e) => setCust({ ...cust, customer_name: e.target.value })} />
              <Input label="Customer phone (optional)" type="tel" value={cust.customer_phone} onChange={(e) => setCust({ ...cust, customer_phone: e.target.value })} />
              <Input label="Discount (UGX)" type="number" min="0" step="any" value={pay.discount} onChange={(e) => setPay({ ...pay, discount: e.target.value })} />
              <Input label="Paid by"><select className="input" value={pay.payment_method} onChange={(e) => setPay({ ...pay, payment_method: e.target.value })}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select></Input>
              {pay.payment_method !== "cash" && <Input full label="Transaction reference" required value={pay.payment_ref} onChange={(e) => setPay({ ...pay, payment_ref: e.target.value })} />}
              {pay.payment_method === "cash" && <Input full label="Cash received (UGX)" type="number" min="0" step="any" value={pay.amount_paid} onChange={(e) => setPay({ ...pay, amount_paid: e.target.value })} placeholder={String(total)} />}
            </div>
            <div className="sale-total"><span>Total</span><b>{ugx(total)}</b>{pay.payment_method === "cash" && change > 0 && <span>Change: <b>{ugx(change)}</b></span>}</div>
            {err && <Notice tone="error">{err}</Notice>}
            <button className="btn primary block" disabled={busy || cart.length === 0 || cart.some((x) => !Number(x.quantity)) || (pay.payment_method !== "cash" && !pay.payment_ref.trim())} onClick={complete}>{busy ? "Completing…" : "Complete sale and make receipt"}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Input label="From" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /><Input label="To" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
            {recs && <div className="sub" style={{ alignSelf: "end", paddingBottom: 10 }}>{recs.length} sales · <b>{ugx(recs.reduce((s, r) => s + r.total, 0))}</b></div>}
          </div>
          <div className="panel">{!recs ? <Spinner /> : recs.length === 0 ? <Empty text="No sales in this period." /> : (
            <div className="scroll"><table className="table"><thead><tr><th>Receipt</th><th>When</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid by</th><th>Reference</th><th /></tr></thead>
              <tbody>{recs.map((s) => <tr key={s.id}><td><b>{s.receipt_no}</b>{s.status === "refunded" && <> <Pill tone="coral">Refunded</Pill></>}</td><td>{fmtStamp(s.created_at)}</td><td>{s.customer_name}</td><td>{s.lines.map((l) => `${l.item_name} x${l.quantity}`).join(", ")}</td><td><b>{ugx(s.total)}</b></td><td>{label(s.payment_method)}</td><td>{s.payment_ref || "-"}</td>
                <td className="row-actions"><button className="btn ghost sm" onClick={() => setReceipt(s)}>Receipt</button><button className="btn ghost sm" onClick={() => setRet(s)}>Return items</button></td></tr>)}</tbody></table></div>)}</div>
        </>
      )}
      {receipt && <DocumentModal doc={DOCS.retail_receipt(receipt)} onClose={() => setReceipt(null)} />}
      {ret && <ReturnModal sale={ret} onClose={() => setRet(null)} onDone={(m) => { setRet(null); setMsg(m); }} />}
    </>
  );
}
