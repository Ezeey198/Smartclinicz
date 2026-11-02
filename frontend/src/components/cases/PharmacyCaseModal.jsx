// The pharmacist's workspace: sell the prescribed drugs, add extra items, generate the ONE bill, and take payment.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import PayModal from "../PayModal";
import { Input, Modal, Notice, Spinner, ugx } from "../ui";
import CaseDetail from "./CaseDetail";

export default function PharmacyCaseModal({ caseId, onClose }) {
  const [d, setD] = useState(null);
  const [lines, setLines] = useState({});
  const [prices, setPrices] = useState([]);
  const [extra, setExtra] = useState({ description: "", quantity: 1, unit_price: "" });
  const [pay, setPay] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/cases/${caseId}`).then((r) => setD(r.data));
  useEffect(() => { load(); api.get("/prices").then((r) => setPrices(r.data)).catch(() => {}); }, [caseId]);
  useEffect(() => {   // start each pending drug with the prescribed quantity and the price-list price
    if (!d) return;
    setLines((cur) => Object.fromEntries(d.prescriptions.filter((r) => r.status === "pending").map((r) => [r.id, cur[r.id] || {
      quantity: r.quantity || 1, unit_price: prices.find((p) => p.category === "pharmacy" && (p.name || "").toLowerCase() === r.drug.trim().toLowerCase())?.price ?? "" }])));
  }, [d, prices]);
  if (!d) return <Modal title="Case" onClose={onClose} wide><Spinner /></Modal>;

  const pending = d.prescriptions.filter((r) => r.status === "pending");
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setD(r.data); setMsg({ tone: "success", text: ok }); } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };
  const setLine = (id, k, v) => setLines({ ...lines, [id]: { ...lines[id], [k]: v } });
  const sale = pending.reduce((s, r) => s + (Number(lines[r.id]?.quantity) || 0) * (Number(lines[r.id]?.unit_price) || 0), 0);

  return (
    <Modal title={`Case ${d.case.case_no}`} onClose={onClose} wide>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {["with_doctor", "at_lab", "back_to_doctor"].includes(d.case.stage) && <Notice>This patient has not been sent to the pharmacy yet.</Notice>}
      {d.case.stage === "completed" && <Notice tone="success">Paid in full. The case is complete.</Notice>}

      {d.case.stage === "at_pharmacy" && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Drugs to sell</h3>
          {pending.length === 0 ? <p className="sub">Every prescribed drug is dealt with. Add anything else the patient is buying, then generate the bill.</p> : (
            <table className="table"><thead><tr><th>Drug</th><th>Prescribed</th><th>Qty sold</th><th>Unit price (UGX)</th><th>Amount</th><th /></tr></thead>
              <tbody>{pending.map((r) => (
                <tr key={r.id}><td><b>{r.drug}</b><div className="sub">{[r.dosage, r.duration].filter(Boolean).join(" · ")}</div></td><td>{r.quantity}</td>
                  <td><input className="input" style={{ width: 90 }} type="number" min="0" step="any" value={lines[r.id]?.quantity ?? ""} onChange={(e) => setLine(r.id, "quantity", e.target.value)} /></td>
                  <td><input className="input" style={{ width: 120 }} type="number" min="0" step="any" value={lines[r.id]?.unit_price ?? ""} onChange={(e) => setLine(r.id, "unit_price", e.target.value)} /></td>
                  <td>{ugx((Number(lines[r.id]?.quantity) || 0) * (Number(lines[r.id]?.unit_price) || 0))}</td>
                  <td><button className="btn ghost sm" disabled={busy} onClick={() => run(() => api.post(`/cases/${caseId}/prescriptions/${r.id}/cancel`), `${r.drug} marked as not supplied.`)}>Not available</button></td></tr>))}</tbody></table>
          )}
          {pending.length > 0 && <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy || pending.some((r) => lines[r.id]?.unit_price === "" || lines[r.id]?.unit_price === undefined)}
              onClick={() => run(() => api.post(`/cases/${caseId}/dispense`, { lines: pending.map((r) => ({ prescription_id: r.id, quantity: Number(lines[r.id].quantity), unit_price: Number(lines[r.id].unit_price) })) }), "Drugs sold and added to the bill.")}>
              Sell these drugs ({ugx(sale)})</button></div>}

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
          <button className="btn primary" onClick={() => setPay(true)}>Receive payment</button>
        </div>
      )}
      <CaseDetail d={d} />
      {pay && <PayModal invoice={d.invoice} onClose={() => setPay(false)} onDone={() => { setPay(false); load(); setMsg({ tone: "success", text: "Payment recorded." }); }} />}
    </Modal>
  );
}
