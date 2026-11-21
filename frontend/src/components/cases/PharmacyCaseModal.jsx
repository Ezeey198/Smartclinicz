// The pharmacist's workspace: sell the prescribed drugs, add extra items, generate the ONE bill, and take payment.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import PayModal from "../PayModal";
import { useAuth } from "../../auth";
import DocumentModal from "../DocumentModal";
import { DOCS } from "../../config/documents";
import { Input, Modal, Notice, Spinner, ugx } from "../ui";
import CaseDetail from "./CaseDetail";

export default function PharmacyCaseModal({ caseId, onClose }) {
  const [d, setD] = useState(null);
  const [lines, setLines] = useState({});
  const [prices, setPrices] = useState([]);
  const [stockItems, setStockItems] = useState([]);       // each drug's next batch gives the selling price
  const [extra, setExtra] = useState({ description: "", quantity: 1, unit_price: "" });
  const { user } = useAuth();
  const [pay, setPay] = useState(false);
  const [hasAcc, setHasAcc] = useState(false);
  const [callMsg, setCallMsg] = useState("");
  const [ask, setAsk] = useState({});                       // a question being written to the doctor, by prescription
  const [labels, setLabels] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/cases/${caseId}`).then((r) => setD(r.data));
  useEffect(() => { load(); api.get("/prices").then((r) => setPrices(r.data)).catch(() => {}); api.get("/stockroom").then((r) => setStockItems(r.data.items)).catch(() => {}); api.get("/clinic/staff", { params: { role: "accountant" } }).then((r) => setHasAcc(r.data.length > 0)).catch(() => {}); }, [caseId]);
  useEffect(() => {   // start each pending drug with the prescribed quantity and the price-list price
    if (!d) return;
    setLines((cur) => Object.fromEntries(d.prescriptions.filter((r) => r.status === "pending").map((r) => [r.id, cur[r.id] || {
      quantity: r.quantity || 1, unit_price: nextPrice(r.drug) ?? prices.find((p) => p.category === "pharmacy" && (p.name || "").toLowerCase() === r.drug.trim().toLowerCase())?.price ?? "" }])));
  }, [d, prices, stockItems]);
  // the selling price of the oldest unexpired batch that has stock (what will actually be dispensed next)
  function nextPrice(drug) {
    const it = stockItems.find((i) => (i.name || "").toLowerCase() === drug.trim().toLowerCase());
    const t = new Date().toISOString().slice(0, 10);
    const b = it?.batches.filter((x) => x.qty_available > 0 && (!x.expiry_date || x.expiry_date >= t)).sort((x, y) => (x.expiry_date || "9999").localeCompare(y.expiry_date || "9999"))[0];
    return b && b.selling_price > 0 ? b.selling_price : undefined;
  }
  if (!d) return <Modal title="Case" onClose={onClose} wide><Spinner /></Modal>;

  const pending = d.prescriptions.filter((r) => r.status === "pending");
  const canCollect = !hasAcc || user.roles?.includes("accountant") || user.roles?.includes("admin");   // with an accountant the pharmacist stops at billing
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setD(r.data); setMsg({ tone: "success", text: ok }); } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };
  const setLine = (id, k, v) => setLines({ ...lines, [id]: { ...lines[id], [k]: v } });
  const sale = pending.reduce((s, r) => s + (Number(lines[r.id]?.quantity) || 0) * (Number(lines[r.id]?.unit_price) || 0), 0);

  return (
    <>
    <Modal title={`Case ${d.case.case_no}`} onClose={onClose} wide>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {["with_doctor", "at_lab", "back_to_doctor"].includes(d.case.stage) && <Notice>This patient has not been sent to the pharmacy yet.</Notice>}
      {d.case.stage === "completed" && <Notice tone="success">Paid in full. The case is complete.</Notice>}

      {["at_pharmacy", "awaiting_payment"].includes(d.case.stage) && user.roles?.includes("pharmacist") && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Call the patient</h3>
          <div className="row"><div style={{ flex: 1 }}><Input label="" full value={callMsg} onChange={(e) => setCallMsg(e.target.value)} placeholder="Optional message, e.g. one drug is out of stock" /></div>
            <button className="btn ghost" disabled={busy} onClick={() => run(async () => { const r = await api.post(`/cases/${caseId}/call-patient`, { message: callMsg }); setCallMsg(""); return r; }, "The patient was called (page and SMS).")}>Call patient</button></div>
        </div>
      )}
      {d.case.stage === "at_pharmacy" && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Drugs to sell</h3>
          {pending.length === 0 ? <p className="sub">Every prescribed drug is dealt with. Add anything else the patient is buying, then generate the bill.</p> : (
            <table className="table"><thead><tr><th>Drug</th><th>Prescribed</th><th>Qty sold</th><th>Unit price (UGX)</th><th>Amount</th><th /></tr></thead>
              <tbody>{pending.map((r) => (
                <tr key={r.id}><td><b>{r.drug}</b><div className="sub">{[r.dosage, r.frequency, r.duration].filter(Boolean).join(" · ")}</div>
                  {r.query_status === "open" && <div style={{ color: "var(--coral)" }}>Waiting for the doctor: “{r.query_note}”</div>}
                  {r.query_status === "answered" && <div className="sub">Doctor answered: “{r.query_reply}”</div>}
                  {ask[r.id] !== undefined && <div className="row" style={{ marginTop: 6 }}><input className="input" autoFocus placeholder="What is unclear?" value={ask[r.id]} onChange={(e) => setAsk({ ...ask, [r.id]: e.target.value })} /><button className="btn primary sm" disabled={busy || ask[r.id].trim().length < 3} onClick={() => run(async () => { const x = await api.post(`/cases/${caseId}/prescriptions/${r.id}/query`, { message: ask[r.id] }); setAsk((a) => { const n = { ...a }; delete n[r.id]; return n; }); return x; }, "Your question was sent to the doctor.")}>Send</button></div>}</td><td>{r.quantity}</td>
                  <td><input className="input" style={{ width: 90 }} type="number" min="0" step="any" value={lines[r.id]?.quantity ?? ""} onChange={(e) => setLine(r.id, "quantity", e.target.value)} /></td>
                  <td><input className="input" style={{ width: 120 }} type="number" min="0" step="any" value={lines[r.id]?.unit_price ?? ""} onChange={(e) => setLine(r.id, "unit_price", e.target.value)} /></td>
                  <td>{ugx((Number(lines[r.id]?.quantity) || 0) * (Number(lines[r.id]?.unit_price) || 0))}</td>
                  <td className="row-actions">{r.query_status !== "open" && ask[r.id] === undefined && <button className="btn ghost sm" onClick={() => setAsk({ ...ask, [r.id]: "" })}>Ask the doctor</button>}<button className="btn ghost sm" disabled={busy} onClick={() => run(() => api.post(`/cases/${caseId}/prescriptions/${r.id}/cancel`), `${r.drug} marked as not supplied.`)}>Not available</button></td></tr>))}</tbody></table>
          )}
          {pending.length > 0 && <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy || pending.some((r) => r.query_status === "open" || lines[r.id]?.unit_price === "" || lines[r.id]?.unit_price === undefined)}
              onClick={() => run(() => api.post(`/cases/${caseId}/dispense`, { lines: pending.map((r) => ({ prescription_id: r.id, quantity: Number(lines[r.id].quantity), unit_price: Number(lines[r.id].unit_price) })) }), "Drugs sold and added to the bill.")}>
              Dispense and bill these drugs ({ugx(sale)})</button>
            {pending.some((r) => r.query_status === "open") && <span className="sub">A drug with an open question cannot be dispensed yet.</span>}</div>}
          {d.prescriptions.some((r) => r.status === "dispensed") && <div style={{ marginTop: 10 }}><button className="btn ghost sm" onClick={() => setLabels(true)}>Print medicine labels</button></div>}

          <h4 style={{ margin: "18px 0 8px" }}>Add another item</h4>
          <div className="line extraline">
            <input className="input" placeholder="Item, e.g. Bandage" value={extra.description} onChange={(e) => setExtra({ ...extra, description: e.target.value })} />
            <input className="input" type="number" min="1" step="any" title="Quantity" value={extra.quantity} onChange={(e) => setExtra({ ...extra, quantity: e.target.value })} />
            <input className="input" type="number" min="0" step="any" placeholder="Unit price" value={extra.unit_price} onChange={(e) => setExtra({ ...extra, unit_price: e.target.value })} />
            <button className="btn ghost sm" disabled={busy || !extra.description.trim() || extra.unit_price === ""}
              onClick={() => run(async () => { const r = await api.post(`/cases/${caseId}/charges`, { description: extra.description, quantity: Number(extra.quantity) || 1, unit_price: Number(extra.unit_price) }); setExtra({ description: "", quantity: 1, unit_price: "" }); return r; }, "Item added to the bill.")}>Add</button>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={busy || pending.length > 0} onClick={() => run(() => api.post(`/cases/${caseId}/bill`), "The bill was generated.")}>Generate the bill ({ugx(d.totals.total)})</button>
            {pending.length > 0 && <span className="sub">Sell or cancel every prescribed drug first.</span>}
          </div>
        </div>
      )}

      {d.case.stage === "awaiting_payment" && d.invoice && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3>Bill {d.invoice.invoice_no}: {ugx(d.invoice.amount)}</h3>
          <p className="sub">Paid {ugx(d.invoice.paid)}. Balance {ugx((d.invoice.amount || 0) - (d.invoice.paid || 0))}.</p>
          {canCollect ? <button className="btn primary" onClick={() => setPay(true)}>Receive payment</button> : <Notice>The bill was sent to the accountant, who receives payment, stamps and prints the documents.</Notice>}
        </div>
      )}
      <CaseDetail d={d} />
      {pay && <PayModal invoice={d.invoice} onClose={() => setPay(false)} onDone={() => { setPay(false); load(); setMsg({ tone: "success", text: "Payment recorded." }); }} />}
    </Modal>
      {labels && <DocumentModal doc={DOCS.medicine_label(d)} onClose={() => setLabels(false)} />}
    </>
  );
}
