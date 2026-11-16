import { useEffect, useMemo, useState } from "react";
import { Plus, Stamp as StampIcon } from "lucide-react";
import api, { errMsg } from "../api";
import { DOCS, STAMPERS } from "../config/documents";
import { useAuth } from "../auth";
import DocumentModal from "./DocumentModal";
import { Empty, Input, Modal, Notice, PageHead, Pill, Spinner, fmtStamp, ugx } from "./ui";

const LAB = /lab|reagent|chemical|equipment|consumable/i;
const CATS = { all: ["Medicine", "Supplies", "Consumables", "Laboratory equipment", "Laboratory reagent", "Laboratory chemical", "Other"],
  pharmacy: ["Medicine", "Supplies", "Consumables", "Other"], lab: ["Laboratory equipment", "Laboratory reagent", "Laboratory chemical", "Consumables"] };
const KINDS = { count: "Stock count", correction: "Correction", damaged: "Damaged", expired: "Expired", lost: "Lost or missing", returned_to_supplier: "Returned to supplier", returned_by_patient: "Returned by patient" };
const OUT = ["damaged", "expired", "lost", "returned_to_supplier"];
const KIND_LABEL = { ...KINDS, received: "Received", dispensed: "Dispensed", edited: "Details edited", opening: "Opening stock" };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// Expiry state of one date: expired, soon (inside the warning window) or fine.
const expiryState = (d, soon) => (!d ? "none" : d < today() ? "expired" : d <= addDays(soon) ? "soon" : "ok");
const ExpiryPill = ({ d, soon }) => { const s = expiryState(d, soon); return <>{d || "-"} {s === "expired" && <Pill tone="coral">Expired</Pill>}{s === "soon" && <Pill tone="amber">Soon</Pill>}</>; };
const blankBatch = { batch_no: "", quantity: "", purchase_price: "", selling_price: "", expiry_date: "", supplier: "", location: "" };
const numOr = (v) => (v === "" || v == null ? 0 : Number(v));

const BatchFields = ({ f, set, data, existing = false }) => (
  <div className="grid2">
    {!existing && <Input label="Batch number" value={f.batch_no} onChange={set("batch_no")} hint="As printed on the pack." />}
    <Input label="Quantity received" type="number" min="0" step="any" required value={f.quantity} onChange={set("quantity")} />
    <Input label="Purchase price (UGX per unit)" type="number" min="0" step="any" value={f.purchase_price} onChange={set("purchase_price")} />
    <Input label="Selling price (UGX per unit)" type="number" min="0" step="any" value={f.selling_price} onChange={set("selling_price")} />
    <Input label="Expiry date" type="date" value={f.expiry_date} onChange={set("expiry_date")} />
    <Input label="Supplier" list="suppliers" value={f.supplier} onChange={set("supplier")} />
    <Input label="Pharmacy location (shelf, store…)" list="locations" value={f.location} onChange={set("location")} />
    <datalist id="suppliers">{data.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
    <datalist id="locations">{data.locations.map((s) => <option key={s} value={s} />)}</datalist>
  </div>
);

// Add stock to something that is already in stock: pick the item, then either a new batch or one of its existing batches.
function AddStockModal({ data, item: preset, batch0, onClose, onDone }) {
  const [q, setQ] = useState(preset ? preset.name : "");
  const [item, setItem] = useState(preset || null);
  const fromBatch = (b) => ({ ...blankBatch, purchase_price: b.purchase_price || "", selling_price: b.selling_price || "", expiry_date: b.expiry_date || "", supplier: b.supplier || "", location: b.location || "" });
  const [choice, setChoice] = useState(batch0 ? String(batch0.id) : "new");
  const [f, setF] = useState(batch0 ? fromBatch(batch0) : blankBatch);
  const [pay, setPay] = useState("yes");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const matches = !item && q.trim() ? data.items.filter((i) => `${i.name} ${i.medicine_code}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const batch = item && choice !== "new" ? item.batches.find((b) => String(b.id) === String(choice)) : null;
  const pick = (b) => { setChoice(b ? String(b.id) : "new"); setF(b ? fromBatch(b) : blankBatch); };
  const cost = numOr(f.quantity) * numOr(f.purchase_price);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.post(`/stockroom/items/${item.id}/stock`, { batch_id: batch ? batch.id : null, batch_no: f.batch_no, quantity: numOr(f.quantity), purchase_price: numOr(f.purchase_price), selling_price: numOr(f.selling_price),
        expiry_date: f.expiry_date || null, supplier: f.supplier, location: f.location, pay_from_wallet: pay === "yes" && cost > 0 });
      onDone(batch ? `Added ${f.quantity} to batch ${batch.batch_no || batch.stock_no}.` : "New batch added. Its Stock ID was made automatically.");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add stock to an existing item" onClose={onClose} wide>
      <form onSubmit={submit}>
        {!item ? (
          <>
            <Input label="Find the item" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or Medicine ID" />
            {matches.length > 0 && <div className="panel picks">{matches.map((m) => <button type="button" key={m.id} onClick={() => { setItem(m); setQ(m.name); }}><b>{m.name}</b><span className="sub">{m.medicine_code} · {m.quantity} {m.unit || ""} available</span></button>)}</div>}
            {q.trim() && matches.length === 0 && <p className="sub">Nothing matches. Use “New item” to add a medicine that is not in stock yet.</p>}
          </>
        ) : (
          <>
            <div className="panel pad" style={{ marginBottom: 14 }}>
              <b>{item.name}</b> <span className="sub">{item.medicine_code} · {item.quantity} {item.unit || ""} available</span>
              {!preset && <button type="button" className="btn ghost sm" style={{ marginLeft: 10 }} onClick={() => { setItem(null); pick(null); }}>Change</button>}
            </div>
            <Input full label="Where does this stock go?">
              <select className="input" value={choice} onChange={(e) => pick(item.batches.find((b) => String(b.id) === e.target.value))}>
                <option value="new">A new batch (gets its own Stock ID)</option>
                {item.batches.map((b) => <option key={b.id} value={b.id}>Add to existing batch · {b.stock_no} · batch {b.batch_no || "-"} · {b.qty_available} available · exp {b.expiry_date || "-"}</option>)}
              </select>
            </Input>
            <BatchFields f={f} set={set} data={data} existing={!!batch} />
            {cost > 0 && <Input full label={`Pay the supplier UGX ${cost.toLocaleString()} from the clinic wallet?`}><select className="input" value={pay} onChange={(e) => setPay(e.target.value)}><option value="yes">Yes, take it from the wallet</option><option value="no">No, paid another way</option></select></Input>}
          </>
        )}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !item || !f.quantity}>{busy ? "Saving…" : batch ? "Add to this batch" : "Add new batch"}</button></div>
      </form>
    </Modal>
  );
}

function NewItemModal({ data, mode, onClose, onDone }) {
  const [it, setIt] = useState({ name: "", category: CATS[mode][0], unit: "", reorder_level: "" });
  const [withStock, setWithStock] = useState(true);
  const [f, setF] = useState(blankBatch);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data: made } = await api.post("/stockroom/items", { ...it, reorder_level: it.reorder_level === "" ? null : Number(it.reorder_level),
        first_batch: withStock && f.quantity ? { batch_no: f.batch_no, quantity: numOr(f.quantity), purchase_price: numOr(f.purchase_price), selling_price: numOr(f.selling_price), expiry_date: f.expiry_date || null, supplier: f.supplier, location: f.location } : null });
      onDone(`${made.name} added with Medicine ID ${made.medicine_code}.`);
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="New item" onClose={onClose} wide>
      <form onSubmit={submit}>
        <Notice>The Medicine ID and every Stock ID are made automatically.</Notice>
        <div className="grid2">
          <Input full label="Medicine or item name" required value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} />
          <Input label="Category"><select className="input" value={it.category} onChange={(e) => setIt({ ...it, category: e.target.value })}>{CATS[mode].map((c) => <option key={c}>{c}</option>)}</select></Input>
          <Input label="Unit (tablets, packs, bottles…)" value={it.unit} onChange={(e) => setIt({ ...it, unit: e.target.value })} />
          <Input label="Reorder level" type="number" min="0" step="any" value={it.reorder_level} onChange={(e) => setIt({ ...it, reorder_level: e.target.value })} hint="You are alerted when stock falls to this." />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}><input type="checkbox" checked={withStock} onChange={(e) => setWithStock(e.target.checked)} />Add the first stock now</label>
        {withStock && <BatchFields f={f} set={set} data={data} />}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !it.name.trim()}>{busy ? "Saving…" : "Add item"}</button></div>
      </form>
    </Modal>
  );
}

function AdjustModal({ batch, item, onClose, onDone }) {
  const [mode, setMode] = useState("set");
  const [kind, setKind] = useState("count");
  const [n, setN] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const out = OUT.includes(kind);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post(`/stockroom/batches/${batch.id}/adjust`, { kind, reason, ...(mode === "set" ? { new_available: Number(n) } : { change: Number(n) }) }); onDone("Stock adjusted and recorded in the history."); }
    catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Adjust stock · ${item.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sub">{batch.stock_no} · batch {batch.batch_no || "-"} · <b>{batch.qty_available}</b> available of {batch.qty_received} received</p>
        <div className="tabs" style={{ marginBottom: 12 }}><button type="button" className={mode === "set" ? "on" : ""} onClick={() => { setMode("set"); setKind("count"); }}>Set the quantity</button><button type="button" className={mode === "change" ? "on" : ""} onClick={() => { setMode("change"); setKind("correction"); }}>Add or remove</button></div>
        <Input label="What is this?"><select className="input" value={kind} onChange={(e) => { setKind(e.target.value); if (OUT.includes(e.target.value)) setMode("change"); else if (e.target.value === "count") setMode("set"); }}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Input>
        <Input label={mode === "set" ? "Quantity actually available now" : out ? "How many to remove" : "Amount to add (use − to remove)"} type="number" step="any" required value={n} onChange={(e) => setN(e.target.value)} min={mode === "set" || out ? "0" : undefined} />
        <Input label="Reason (required)" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Counted on the shelf, 3 tablets broken" />
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={n === "" || reason.trim().length < 3}>Save adjustment</button></div>
      </form>
    </Modal>
  );
}

function EditBatchModal({ batch, data, onClose, onDone }) {
  const [f, setF] = useState({ batch_no: batch.batch_no || "", purchase_price: batch.purchase_price || "", selling_price: batch.selling_price || "", expiry_date: batch.expiry_date || "", supplier: batch.supplier || "", location: batch.location || "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { await api.patch(`/stockroom/batches/${batch.id}`, f); onDone("Details saved and recorded in the history."); } catch (x) { setErr(errMsg(x)); } };
  return (
    <Modal title={`Edit details · ${batch.stock_no}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input label="Batch number" value={f.batch_no} onChange={set("batch_no")} />
          <Input label="Expiry date" type="date" value={f.expiry_date} onChange={set("expiry_date")} />
          <Input label="Purchase price (UGX per unit)" type="number" min="0" step="any" value={f.purchase_price} onChange={set("purchase_price")} />
          <Input label="Selling price (UGX per unit)" type="number" min="0" step="any" value={f.selling_price} onChange={set("selling_price")} />
          <Input label="Supplier" list="suppliers" value={f.supplier} onChange={set("supplier")} />
          <Input label="Pharmacy location" list="locations" value={f.location} onChange={set("location")} />
        </div>
        <datalist id="suppliers">{data.suppliers.map((s) => <option key={s} value={s} />)}</datalist><datalist id="locations">{data.locations.map((s) => <option key={s} value={s} />)}</datalist>
        <p className="hint">The quantity is changed with “Adjust”, so every change to it has a reason in the history.</p>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save details</button></div>
      </form>
    </Modal>
  );
}

const HistoryTable = ({ rows, showItem }) => (rows.length === 0 ? <Empty text="No stock changes recorded yet." /> : (
  <div className="scroll"><table className="table"><thead><tr><th>When</th>{showItem && <th>Item</th>}<th>Stock ID</th><th>What</th><th>Change</th><th>Before → After</th><th>Reason</th><th>By</th></tr></thead>
    <tbody>{rows.map((h) => <tr key={h.id}><td>{fmtStamp(h.created_at)}</td>{showItem && <td><b>{h.item}</b><div className="sub">{h.medicine_code}</div></td>}<td>{h.stock_no || "-"}</td><td><Pill tone={h.change < 0 ? "coral" : h.change > 0 ? "green" : "gray"}>{KIND_LABEL[h.kind] || h.kind}</Pill></td>
      <td style={{ color: h.change < 0 ? "var(--coral)" : undefined }}><b>{h.change > 0 ? "+" : ""}{h.change}</b></td><td>{h.before} → {h.after}</td><td>{h.reason}</td><td>{h.user_name}</td></tr>)}</tbody></table></div>));

function ItemModal({ item, data, canWrite, canStamp, onClose, onChanged, onStamp }) {
  const [tab, setTab] = useState("batches");
  const [hist, setHist] = useState(null);
  const [sub, setSub] = useState(null);                 // { type: "adjust" | "edit" | "add", batch }
  useEffect(() => { if (tab === "history") api.get("/stockroom/history", { params: { item_id: item.id } }).then((r) => setHist(r.data)); }, [tab, item.id, item.quantity]);
  return (
    <>
    <Modal title={`${item.name} · ${item.medicine_code}`} onClose={onClose} wide="xl">
      <p className="sub" style={{ marginTop: 0 }}>{item.category} · <b>{item.quantity} {item.unit || ""}</b> available{item.reorder_level != null && <> · reorder at {item.reorder_level}</>}</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {canWrite && <button className="btn primary sm" onClick={() => setSub({ type: "add" })}><Plus size={14} />Add stock</button>}
        {canStamp && <button className="btn ghost sm" onClick={() => onStamp(item)}><StampIcon size={14} />Print and stamp stock record</button>}
      </div>
      <div className="tabs" style={{ marginBottom: 12 }}><button className={tab === "batches" ? "on" : ""} onClick={() => setTab("batches")}>Stock entries</button><button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Adjustment history</button></div>
      {tab === "batches" ? (item.batches.length === 0 ? <Empty text="No stock received yet. Press Add stock." /> : (
        <div className="scroll"><table className="table"><thead><tr><th>Stock ID</th><th>Batch</th><th>Received</th><th>Available</th><th>Purchase</th><th>Selling</th><th>Expiry</th><th>Supplier</th><th>Location</th>{canWrite && <th />}</tr></thead>
          <tbody>{item.batches.map((b) => (
            <tr key={b.id}><td><b>{b.stock_no}</b></td><td>{b.batch_no || "-"}</td><td>{b.qty_received}</td><td><b>{b.qty_available}</b></td><td>{ugx(b.purchase_price)}</td><td>{ugx(b.selling_price)}</td>
              <td><ExpiryPill d={b.expiry_date} soon={data.soon_days} /></td><td>{b.supplier || "-"}</td><td>{b.location || "-"}</td>
              {canWrite && <td className="row-actions"><button className="btn ghost sm" onClick={() => setSub({ type: "add", batch: b })}>Add to batch</button><button className="btn ghost sm" onClick={() => setSub({ type: "adjust", batch: b })}>Adjust</button><button className="btn ghost sm" onClick={() => setSub({ type: "edit", batch: b })}>Edit</button></td>}</tr>))}</tbody></table></div>)
      ) : (hist ? <HistoryTable rows={hist} /> : <Spinner />)}
    </Modal>
      {sub?.type === "add" && <AddStockModal data={data} item={item} batch0={sub.batch} onClose={() => setSub(null)} onDone={(m) => { setSub(null); onChanged(m); }} />}
      {sub?.type === "adjust" && <AdjustModal batch={sub.batch} item={item} onClose={() => setSub(null)} onDone={(m) => { setSub(null); onChanged(m); }} />}
      {sub?.type === "edit" && <EditBatchModal batch={sub.batch} data={data} onClose={() => setSub(null)} onDone={(m) => { setSub(null); onChanged(m); }} />}
    </>
  );
}

// The clinic's stock records. mode: "all" (admin), "pharmacy" (pharmacist: everything except laboratory items) or "lab" (laboratory items only).
export default function StockManager({ mode = "all" }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("stock");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [modal, setModal] = useState(null);       // "add" | "new" | { add: item }
  const [doc, setDoc] = useState(null);
  const [hist, setHist] = useState(null);
  const canWrite = user.modules?.inventory === "write";
  const canStamp = user.roles?.includes("admin") || user.roles?.some((r) => STAMPERS.goods_received.includes(r));
  const load = () => api.get("/stockroom").then((r) => setData(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "history") api.get("/stockroom/history", { params: { limit: 300 } }).then((r) => setHist(r.data)).catch(() => {}); }, [tab, data]);

  const items = useMemo(() => (data?.items || []).filter((i) => (mode === "lab" ? LAB.test(i.category || "") : mode === "pharmacy" ? !LAB.test(i.category || "") : true)), [data, mode]);
  const soon = data?.soon_days || 30;
  const stat = (i) => ({ low: i.reorder_level != null && i.quantity <= i.reorder_level, exp: i.batches.some((b) => b.qty_available > 0 && expiryState(b.expiry_date, soon) === "expired"), soon: i.batches.some((b) => b.qty_available > 0 && expiryState(b.expiry_date, soon) === "soon") });
  const shown = items.filter((i) => (filter === "all" || (filter === "low" && stat(i).low) || (filter === "exp" && stat(i).exp) || (filter === "soon" && stat(i).soon))
    && (!q.trim() || `${i.name} ${i.medicine_code} ${i.category} ${i.locations.join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const counts = { low: items.filter((i) => stat(i).low).length, exp: items.filter((i) => stat(i).exp).length, soon: items.filter((i) => stat(i).soon).length };
  const changed = async (m) => { setMsg(m); setModal(null); await load(); };
  const current = open && items.find((i) => i.id === open);

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!data) return <Spinner />;
  const noun = mode === "lab" ? "Laboratory stock" : mode === "pharmacy" ? "Pharmacy stock" : "Stock";
  return (
    <>
      <PageHead title={noun} sub="Every item has a Medicine ID and every received batch a Stock ID, made automatically. Dispensing takes from the oldest unexpired batch first.">
        {canWrite && <><button className="btn primary" onClick={() => setModal("add")}><Plus size={16} />Add stock to existing item</button><button className="btn ghost" onClick={() => setModal("new")}>New item</button></>}
      </PageHead>
      {msg && <Notice tone="success">{msg}</Notice>}
      <div className="tabs" style={{ marginBottom: 12 }}><button className={tab === "stock" ? "on" : ""} onClick={() => setTab("stock")}>Stock</button><button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Adjustment history</button></div>
      {tab === "history" ? <div className="panel">{hist ? <HistoryTable rows={hist.filter((h) => items.some((i) => i.medicine_code === h.medicine_code))} showItem /> : <Spinner />}</div> : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[["all", `All items (${items.length})`], ["low", `Running low (${counts.low})`], ["soon", `Expiring in ${soon} days (${counts.soon})`], ["exp", `Expired stock (${counts.exp})`]].map(([k, l]) => <button key={k} className={`btn sm ${filter === k ? "primary" : "ghost"}`} onClick={() => setFilter(k)}>{l}</button>)}
            <input className="input" style={{ maxWidth: 280, marginLeft: "auto" }} placeholder="Search name, Medicine ID, location" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="panel">
            {shown.length === 0 ? <Empty text={items.length === 0 ? "No stock yet. Press New item to add the first one." : "Nothing matches."} /> : (
              <div className="scroll"><table className="table"><thead><tr><th>Medicine ID</th><th>Item</th><th>Category</th><th>Available</th><th>Nearest expiry</th><th>Location</th><th>Batches</th><th /></tr></thead>
                <tbody>{shown.map((i) => { const s = stat(i); return (
                  <tr key={i.id}><td>{i.medicine_code}</td><td><b>{i.name}</b></td><td>{i.category || "-"}</td>
                    <td><b>{i.quantity}</b> {i.unit || ""} {s.low && <Pill tone="coral">Low</Pill>}</td><td><ExpiryPill d={i.expiry_date} soon={soon} />{s.exp && <Pill tone="coral">Expired batch</Pill>}</td>
                    <td>{i.locations.join(", ") || "-"}</td><td>{i.batches.length}</td>
                    <td className="row-actions">{canWrite && <button className="btn ghost sm" onClick={() => setModal({ add: i })}>Add stock</button>}<button className="btn primary sm" onClick={() => setOpen(i.id)}>Details</button></td></tr>); })}</tbody></table></div>)}
          </div>
        </>)}
      {modal === "add" && <AddStockModal data={data} onClose={() => setModal(null)} onDone={changed} />}
      {modal?.add && <AddStockModal data={data} item={modal.add} onClose={() => setModal(null)} onDone={changed} />}
      {modal === "new" && <NewItemModal data={data} mode={mode} onClose={() => setModal(null)} onDone={changed} />}
      {current && <ItemModal item={current} data={data} canWrite={canWrite} canStamp={canStamp} onClose={() => setOpen(null)} onChanged={changed} onStamp={(i) => setDoc(DOCS.goods_received(i))} />}
      {doc && <DocumentModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  );
}
