// The doctor's workspace for one case: consultation notes, then send the patient to the lab and/or the pharmacy.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice, Pill, Spinner } from "../ui";
import CaseDetail from "./CaseDetail";

const FIELDS = ["temperature", "blood_pressure", "pulse", "weight", "complaints", "diagnosis", "treatment_notes"];

export default function DoctorCaseModal({ caseId, onClose }) {
  const [d, setD] = useState(null);
  const [n, setN] = useState({});
  const [tests, setTests] = useState([{ test_name: "", notes: "" }]);
  const [rx, setRx] = useState([{ drug: "", dosage: "", frequency: "", duration: "", quantity: 1 }]);
  const [prices, setPrices] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [hasRad, setHasRad] = useState(false);
  const [rep, setRep] = useState({});                    // answers to the pharmacist's questions, by prescription
  const [dest, setDest] = useState("lab");
  const [assign, setAssign] = useState({ nurse_id: "", room: "", bed: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/cases/${caseId}`).then((r) => { setD(r.data); setN({ ...Object.fromEntries(FIELDS.map((k) => [k, r.data.case[k] || ""])), consultation_fee: r.data.case.consult_fee ?? "" }); setAssign({ nurse_id: r.data.case.nurse_id || "", room: r.data.case.room || "", bed: r.data.case.bed || "" }); });
  useEffect(() => {
    load(); api.get("/prices").then((r) => setPrices(r.data)).catch(() => {});
    api.get("/cases/nurses").then((r) => setNurses(r.data)).catch(() => {});
    api.get("/clinic/staff", { params: { role: "radiologist" } }).then((r) => setHasRad(r.data.length > 0)).catch(() => {});
  }, [caseId]);
  useEffect(() => {   // while the patient is at the lab, pick up the results as soon as they are done
    if (!d || d.case.stage !== "at_lab") return undefined;
    const id = setInterval(() => api.get(`/cases/${caseId}`).then((r) => setD(r.data)).catch(() => {}), 8000);
    return () => clearInterval(id);
  }, [d?.case.stage, caseId]);
  if (!d) return <Modal title="Case" onClose={onClose} wide><Spinner /></Modal>;

  const mine = ["with_doctor", "back_to_doctor"].includes(d.case.stage);
  const priceOf = (cat, name) => prices.find((p) => p.category === cat && (p.name || "").toLowerCase() === name.trim().toLowerCase())?.price;
  const names = (cat) => prices.filter((p) => p.category === cat && p.name).map((p) => p.name);
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setD(r.data); setMsg({ tone: "success", text: ok }); } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };
  const save = () => api.patch(`/cases/${caseId}/consultation`, { ...n, consultation_fee: n.consultation_fee === "" || n.consultation_fee == null ? null : Number(n.consultation_fee) });
  const feeSet = d.case.consult_fee != null || (n.consultation_fee !== "" && n.consultation_fee != null);
  const upd = (list, set, i, k, v) => set(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <Modal title={`Case ${d.case.case_no}`} onClose={onClose} wide>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {d.case.stage === "awaiting_doctor" && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3>Patient assigned to you{d.case.visit_no > 1 ? ` (visit No. ${d.case.visit_no})` : ""}</h3>
          <p className="sub">The receptionist has registered this patient. Confirm to call the patient in and start the consultation.</p>
          <button className="btn primary" disabled={busy} onClick={() => run(() => api.post(`/cases/${caseId}/confirm`), "Patient confirmed. The consultation can start.")}>Confirm and start consultation</button>
        </div>
      )}
      {d.case.stage === "back_to_doctor" && <Notice tone="success">The lab has finished. Read the results below, then prescribe or send the patient on.</Notice>}
      {d.case.stage === "at_lab" && <Notice>The patient is at the lab. This case returns to you when every test is completed.</Notice>}
      {d.case.stage === "at_pharmacy" && <Notice>The patient is with the pharmacist.</Notice>}
      {d.prescriptions.filter((r) => r.query_status === "open" && r.status === "pending").map((r) => (
        <div key={r.id} className="panel pad" style={{ marginBottom: 16, borderColor: "var(--coral)" }}>
          <h3>The pharmacist has a question about {r.drug}</h3>
          <p style={{ margin: "6px 0" }}>“{r.query_note}”</p>
          <p className="sub">{[r.dosage, r.frequency, r.duration, `Qty ${r.quantity}`].filter(Boolean).join(" · ")}</p>
          <Input full label="Your answer" value={(rep[r.id] || {}).reply || ""} onChange={(e) => setRep({ ...rep, [r.id]: { ...(rep[r.id] || {}), reply: e.target.value } })} />
          <div className="grid2">{[["drug", "Correct the drug"], ["dosage", "Correct the dosage"], ["frequency", "Correct how often"], ["duration", "Correct the days"], ["quantity", "Correct the quantity"]].map(([k, l]) => (
            <Input key={k} label={`${l} (only if it was wrong)`} value={(rep[r.id] || {})[k] || ""} onChange={(e) => setRep({ ...rep, [r.id]: { ...(rep[r.id] || {}), [k]: e.target.value } })} />))}</div>
          <button className="btn primary" disabled={busy || !((rep[r.id] || {}).reply || "").trim()} onClick={() => run(() => { const x = rep[r.id]; return api.post(`/cases/${caseId}/prescriptions/${r.id}/reply`, { reply: x.reply, drug: x.drug || null, dosage: x.dosage || null, frequency: x.frequency || null, duration: x.duration || null, quantity: x.quantity ? Number(x.quantity) : null }); }, "Answer sent to the pharmacist.")}>Send answer</button>
        </div>))}

      {d.labs.length > 0 && (
        <div className="panel pad results" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Lab results {d.labs.every((l) => l.status === "completed") ? <Pill tone="green">All ready</Pill> : <Pill tone="amber">Some still waiting</Pill>}</h3>
          <table className="table"><thead><tr><th>Test</th><th>Result</th><th>Status</th></tr></thead>
            <tbody>{d.labs.map((l) => <tr key={l.id}><td><b>{l.test_name}</b></td><td>{l.result || <span className="sub">Not entered yet</span>}</td><td><Pill value={l.status} /></td></tr>)}</tbody></table>
          {mine && <p className="hint" style={{ marginBottom: 0 }}>Use these results to prescribe below, or send the patient to the pharmacy.</p>}
        </div>
      )}

      {mine && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Consultation</h3>
          <div className="grid2">
            {[["temperature", "Temperature (°C)"], ["blood_pressure", "Blood pressure"], ["pulse", "Pulse (bpm)"], ["weight", "Weight (kg)"]].map(([k, l]) => <Input key={k} label={l} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} />)}
            <Input full label="Consultation fee (UGX). Required, and it can be 0" type="number" min="0" step="any" value={n.consultation_fee} onChange={(e) => setN({ ...n, consultation_fee: e.target.value })} hint="The patient cannot be sent on until the fee is entered." />
            {[["complaints", "Presenting complaints"], ["diagnosis", "Diagnosis"], ["treatment_notes", "Treatment notes"]].map(([k, l]) => (
              <Input key={k} full label={l}><textarea className="input" rows={2} value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} /></Input>))}
          </div>
          <button className="btn ghost" disabled={busy} onClick={() => run(save, "Consultation notes saved.")}>Save notes</button>
        </div>
      )}

      {mine && (
        <div className="grid2 forward">
          <div className="panel pad">
            <h3 style={{ marginBottom: 10 }}>{dest === "radiology" ? "Send to the radiologist" : "Send to the lab"}</h3>
            {hasRad && <div className="tabs" style={{ marginBottom: 10 }}><button type="button" className={dest === "lab" ? "on" : ""} onClick={() => setDest("lab")}>Lab technician</button><button type="button" className={dest === "radiology" ? "on" : ""} onClick={() => setDest("radiology")}>Radiologist</button></div>}
            <datalist id="labnames">{names("lab").map((x) => <option key={x} value={x} />)}</datalist>
            {tests.map((t, i) => (
              <div className="line" key={i}>
                <input className="input" list="labnames" placeholder="Test, e.g. Malaria test" value={t.test_name} onChange={(e) => upd(tests, setTests, i, "test_name", e.target.value)} />
                <span className="sub">{priceOf("lab", t.test_name) != null ? `UGX ${Number(priceOf("lab", t.test_name)).toLocaleString()}` : ""}</span>
              </div>))}
            <div className="row"><button className="btn ghost sm" onClick={() => setTests([...tests, { test_name: "", notes: "" }])}>+ Add test</button>
              <button className="btn primary" disabled={busy || !feeSet || !tests.some((t) => t.test_name.trim())}
                onClick={() => run(async () => { await save(); return api.post(`/cases/${caseId}/lab`, { destination: dest, tests: tests.filter((t) => t.test_name.trim()) }); }, dest === "radiology" ? "Sent to the radiologist." : "Sent to the lab technician.")}>{dest === "radiology" ? "Send to radiologist" : "Send to lab technician"}</button></div>
          </div>
          <div className="panel pad">
            <h3 style={{ marginBottom: 10 }}>Send to the pharmacy</h3>
            <datalist id="drugnames">{names("pharmacy").map((x) => <option key={x} value={x} />)}</datalist>
            {rx.map((r, i) => (
              <div className="line rxline" key={i}>
                <input className="input" list="drugnames" placeholder="Drug" value={r.drug} onChange={(e) => upd(rx, setRx, i, "drug", e.target.value)} />
                <input className="input" placeholder="Dosage" value={r.dosage} onChange={(e) => upd(rx, setRx, i, "dosage", e.target.value)} />
                <input className="input" placeholder="How often" title="Frequency, e.g. three times a day" value={r.frequency} onChange={(e) => upd(rx, setRx, i, "frequency", e.target.value)} />
                <input className="input" placeholder="Days" value={r.duration} onChange={(e) => upd(rx, setRx, i, "duration", e.target.value)} />
                <input className="input" type="number" min="1" step="any" title="Quantity" value={r.quantity} onChange={(e) => upd(rx, setRx, i, "quantity", e.target.value)} />
              </div>))}
            <div className="row"><button className="btn ghost sm" onClick={() => setRx([...rx, { drug: "", dosage: "", frequency: "", duration: "", quantity: 1 }])}>+ Add drug</button>
              <button className="btn primary" disabled={busy || !feeSet}
                onClick={() => run(async () => { await save(); return api.post(`/cases/${caseId}/pharmacy`, { prescriptions: rx.filter((r) => r.drug.trim()).map((r) => ({ ...r, quantity: Number(r.quantity) || 1 })) }); }, "Sent to the pharmacist.")}>
                {rx.some((r) => r.drug.trim()) ? "Prescribe and send to pharmacist" : "No drugs: send for billing"}</button></div>
          </div>
        </div>
      )}
      {!["awaiting_doctor", "completed"].includes(d.case.stage) && (
        <div className="panel pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Nurse, room and bed</h3>
          <div className="grid2">
            <Input label="Assign to nurse"><select className="input" value={assign.nurse_id} onChange={(e) => setAssign({ ...assign, nurse_id: e.target.value })}><option value="">No nurse</option>{nurses.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Input>
            <Input label="Room" value={assign.room} onChange={(e) => setAssign({ ...assign, room: e.target.value })} />
            <Input label="Bed" value={assign.bed} onChange={(e) => setAssign({ ...assign, bed: e.target.value })} />
          </div>
          <button className="btn ghost" disabled={busy} onClick={() => run(() => api.post(`/cases/${caseId}/assign-nurse`, { nurse_id: assign.nurse_id ? Number(assign.nurse_id) : null, room: assign.room, bed: assign.bed }), "Nurse, room and bed saved. The nurse and the patient were notified.")}>Save assignment</button>
        </div>
      )}
      <CaseDetail d={d} />
    </Modal>
  );
}
