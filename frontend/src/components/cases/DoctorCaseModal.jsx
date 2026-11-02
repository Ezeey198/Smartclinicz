// The doctor's workspace for one case: consultation notes, then send the patient to the lab and/or the pharmacy.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice, Spinner } from "../ui";
import CaseDetail from "./CaseDetail";

const FIELDS = ["temperature", "blood_pressure", "pulse", "weight", "complaints", "diagnosis", "treatment_notes"];

export default function DoctorCaseModal({ caseId, onClose }) {
  const [d, setD] = useState(null);
  const [n, setN] = useState({});
  const [tests, setTests] = useState([{ test_name: "", notes: "" }]);
  const [rx, setRx] = useState([{ drug: "", dosage: "", duration: "", quantity: 1 }]);
  const [prices, setPrices] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/cases/${caseId}`).then((r) => { setD(r.data); setN(Object.fromEntries(FIELDS.map((k) => [k, r.data.case[k] || ""]))); });
  useEffect(() => { load(); api.get("/prices").then((r) => setPrices(r.data)).catch(() => {}); }, [caseId]);
  if (!d) return <Modal title="Case" onClose={onClose} wide><Spinner /></Modal>;

  const mine = ["with_doctor", "back_to_doctor"].includes(d.case.stage);
  const priceOf = (cat, name) => prices.find((p) => p.category === cat && (p.name || "").toLowerCase() === name.trim().toLowerCase())?.price;
  const names = (cat) => prices.filter((p) => p.category === cat && p.name).map((p) => p.name);
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setD(r.data); setMsg({ tone: "success", text: ok }); } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };
  const save = () => api.patch(`/cases/${caseId}/consultation`, n);
  const upd = (list, set, i, k, v) => set(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <Modal title={`Case ${d.case.case_no}`} onClose={onClose} wide>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {d.case.stage === "back_to_doctor" && <Notice tone="success">The lab has finished. Read the results below, then prescribe or send the patient on.</Notice>}
      {d.case.stage === "at_lab" && <Notice>The patient is at the lab. This case returns to you when every test is completed.</Notice>}
      {d.case.stage === "at_pharmacy" && <Notice>The patient is with the pharmacist.</Notice>}

      {mine && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Consultation</h3>
          <div className="grid2">
            {[["temperature", "Temperature (°C)"], ["blood_pressure", "Blood pressure"], ["pulse", "Pulse (bpm)"], ["weight", "Weight (kg)"]].map(([k, l]) => <Input key={k} label={l} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} />)}
            {[["complaints", "Presenting complaints"], ["diagnosis", "Diagnosis"], ["treatment_notes", "Treatment notes"]].map(([k, l]) => (
              <Input key={k} full label={l}><textarea className="input" rows={2} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} /></Input>))}
          </div>
          <button className="btn ghost" disabled={busy} onClick={() => run(save, "Consultation notes saved.")}>Save notes</button>
        </div>
      )}

      {mine && (
        <div className="grid2 forward">
          <div className="panel pad">
            <h3 style={{ marginBottom: 10 }}>Send to the lab</h3>
            <datalist id="labnames">{names("lab").map((x) => <option key={x} value={x} />)}</datalist>
            {tests.map((t, i) => (
              <div className="line" key={i}>
                <input className="input" list="labnames" placeholder="Test, e.g. Malaria test" value={t.test_name} onChange={(e) => upd(tests, setTests, i, "test_name", e.target.value)} />
                <span className="sub">{priceOf("lab", t.test_name) != null ? `UGX ${Number(priceOf("lab", t.test_name)).toLocaleString()}` : ""}</span>
              </div>))}
            <div className="row"><button className="btn ghost sm" onClick={() => setTests([...tests, { test_name: "", notes: "" }])}>+ Add test</button>
              <button className="btn primary" disabled={busy || !tests.some((t) => t.test_name.trim())}
                onClick={() => run(async () => { await save(); return api.post(`/cases/${caseId}/lab`, { tests: tests.filter((t) => t.test_name.trim()) }); }, "Sent to the lab technician.")}>Send to lab technician</button></div>
          </div>
          <div className="panel pad">
            <h3 style={{ marginBottom: 10 }}>Send to the pharmacy</h3>
            <datalist id="drugnames">{names("pharmacy").map((x) => <option key={x} value={x} />)}</datalist>
            {rx.map((r, i) => (
              <div className="line rxline" key={i}>
                <input className="input" list="drugnames" placeholder="Drug" value={r.drug} onChange={(e) => upd(rx, setRx, i, "drug", e.target.value)} />
                <input className="input" placeholder="Dosage" value={r.dosage} onChange={(e) => upd(rx, setRx, i, "dosage", e.target.value)} />
                <input className="input" placeholder="Days" value={r.duration} onChange={(e) => upd(rx, setRx, i, "duration", e.target.value)} />
                <input className="input" type="number" min="1" step="any" title="Quantity" value={r.quantity} onChange={(e) => upd(rx, setRx, i, "quantity", e.target.value)} />
              </div>))}
            <div className="row"><button className="btn ghost sm" onClick={() => setRx([...rx, { drug: "", dosage: "", duration: "", quantity: 1 }])}>+ Add drug</button>
              <button className="btn primary" disabled={busy}
                onClick={() => run(async () => { await save(); return api.post(`/cases/${caseId}/pharmacy`, { prescriptions: rx.filter((r) => r.drug.trim()).map((r) => ({ ...r, quantity: Number(r.quantity) || 1 })) }); }, "Sent to the pharmacist.")}>
                {rx.some((r) => r.drug.trim()) ? "Prescribe and send to pharmacist" : "No drugs: send for billing"}</button></div>
          </div>
        </div>
      )}
      <CaseDetail d={d} />
    </Modal>
  );
}
