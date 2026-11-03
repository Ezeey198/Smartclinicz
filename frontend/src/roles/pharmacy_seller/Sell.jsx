// The pharmacy counter: search, build the sale, take payment, print the receipt.
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import DocumentModal from "../../components/DocumentModal";
import { DOCS } from "../../config/documents";
import { Empty, Input, Notice, PageHead, Pill, Spinner, ugx } from "../../components/ui";

export default function Sell() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [cust, setCust] = useState({ name: "", phone: "" });
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const load = () => api.get("/pharmacy/stock").then((r) => setItems(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);
  if (!items) return <Spinner />;

  const add = (p) => {
    if (p.stock <= 0) return setMsg({ tone: "error", text: `${p.name} is out of stock.` });
    setMsg(null);
    setCart((c) => {
      const i = c.findIndex((x) => x.product.id === p.id);
      if (i < 0) return [...c, { product: p, quantity: 1, rx: false }];
      const n = [...c]; n[i] = { ...n[i], quantity: Math.min(p.stock, Number(n[i].quantity) + 1) }; return n;
    });
  };
  const matches = items.filter((p) => `${p.name} ${p.generic_name || ""} ${p.sku || ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const onEnter = (e) => {   // a barcode scanner types the code and presses Enter
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exact = items.find((p) => p.sku && p.sku.toLowerCase() === q.trim().toLowerCase());
    const one = exact || (matches.length === 1 ? matches[0] : null);
    if (one) { add(one); setQ(""); }
  };
  const setLine = (i, k, v) => setCart(cart.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const subtotal = cart.reduce((s, l) => s + (Number(l.quantity) || 0) * l.product.selling_price, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - disc;
  const change = method === "cash" ? Math.max(0, (paid === "" ? total : Number(paid)) - total) : 0;
  const needRx = cart.some((l) => l.product.prescription_required && !l.rx);

  const complete = async () => {
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.post("/pharmacy/sales", {
        customer_name: cust.name, customer_phone: cust.phone, discount: disc, payment_method: method, amount_paid: method === "cash" && paid !== "" ? Number(paid) : null,
        lines: cart.map((l) => ({ product_id: l.product.id, quantity: Number(l.quantity), rx_confirmed: l.rx })) });
      setReceipt(DOCS.sale_receipt(data));
      setCart([]); setCust({ name: "", phone: "" }); setDiscount(""); setPaid(""); setMethod("cash");
      load();
    } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Sell" sub="Search for a medicine or scan its barcode, build the sale, take payment and print the receipt." />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="pos">
        <div className="panel">
          <div style={{ padding: 14 }}><input className="input" autoFocus placeholder="Search by name, generic name or barcode" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onEnter} /></div>
          {items.length === 0 ? <Empty text="No products yet. The pharmacy admin adds products and stock." /> : (
            <div className="prod-list">{matches.map((p) => (
              <button key={p.id} disabled={p.stock <= 0} onClick={() => add(p)}>
                <span><b>{p.name}</b> {p.prescription_required && <Pill tone="blue">Rx</Pill>}<span className="sub"> {p.generic_name}</span></span>
                <b>{ugx(p.selling_price)}</b>
                <span className="sub">{p.stock > 0 ? `${p.stock} ${p.unit || ""} in stock` : "Out of stock"}{p.next_expiry ? ` · expires ${p.next_expiry}` : ""}</span>
                <span>{p.low && p.stock > 0 && <Pill tone="coral">Low</Pill>}</span>
              </button>))}</div>
          )}
        </div>

        <div className="panel pad">
          <h3 style={{ marginBottom: 8 }}>Current sale</h3>
          {cart.length === 0 ? <p className="sub">Nothing added yet. Click a medicine on the left.</p> : cart.map((l, i) => (
            <div key={l.product.id}>
              <div className="cart-line">
                <div><b>{l.product.name}</b><div className="sub">{ugx(l.product.selling_price)} each</div></div>
                <input className="input" type="number" min="1" max={l.product.stock} step="any" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} />
                <b>{ugx((Number(l.quantity) || 0) * l.product.selling_price)}</b>
                <button className="icon-btn danger" title="Remove" onClick={() => setCart(cart.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
              </div>
              {l.product.prescription_required && <label className="rx-check"><input type="checkbox" checked={l.rx} onChange={(e) => setLine(i, "rx", e.target.checked)} /> I have seen a prescription for {l.product.name}</label>}
            </div>))}
          <div className="grid2" style={{ marginTop: 14 }}>
            <Input label="Customer name (optional)" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            <Input label="Phone (optional)" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
            <Input label="Discount (UGX)" type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Input label="Paid by"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="card">Card</option></select></Input>
            {method === "cash" && <Input full label="Cash received (UGX)" type="number" min="0" step="any" value={paid} placeholder={String(total)} onChange={(e) => setPaid(e.target.value)} />}
          </div>
          <div className="cart-total"><div><span>Subtotal</span><span>{ugx(subtotal)}</span></div>{disc > 0 && <div><span>Discount</span><span>-{ugx(disc)}</span></div>}
            <div className="grand"><span>Total</span><span>{ugx(total)}</span></div>{method === "cash" && <div><span>Change to give</span><b>{ugx(change)}</b></div>}</div>
          <button className="btn primary block" disabled={busy || cart.length === 0 || needRx} onClick={complete}>{busy ? "Saving…" : `Complete sale (${ugx(total)})`}</button>
          {needRx && <p className="hint">Confirm you have seen the prescription for each marked medicine.</p>}
        </div>
      </div>
      {receipt && <DocumentModal doc={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
