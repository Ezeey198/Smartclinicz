// The doctor receives a patient: pick someone already on record, or register a new patient on the spot.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice } from "../ui";

export default function OpenCaseModal({ onClose, onDone }) {
  const [mode, setMode] = useState("existing");
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [pid, setPid] = useState("");
  const [f, setF] = useState({ full_name: "", gender: "", date_of_birth: "", phone: "", address: "", next_of_kin: "", next_of_kin_phone: "", blood_group: "", allergies: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/patients").then((r) => setPatients(r.data)); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const matches = q.trim() ? patients.filter((p) => `${p.full_name} ${p.patient_no} ${p.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const { data } = await api.post("/cases/open", mode === "existing" ? { patient_id: Number(pid) } : f); onDone(data); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Receive a patient" onClose={onClose} wide>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button type="button" className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")}>Patient on record</button>
        <button type="button" className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>New patient</button>
      </div>
      <form onSubmit={submit}>
        {mode === "existing" ? (
          <>
            <Input label="Find the patient" value={q} onChange={(e) => { setQ(e.target.value); setPid(""); }} placeholder="Name, patient number or phone" />
            {matches.length > 0 && !pid && <div className="panel picks" style={{ marginBottom: 14 }}>{matches.map((m) => (
              <button type="button" key={m.id} onClick={() => { setPid(m.id); setQ(`${m.full_name} (${m.patient_no})`); }}><b>{m.full_name}</b><span className="sub">{m.patient_no} · {m.phone}</span></button>))}</div>}
          </>
        ) : (
          <div className="grid2">
            <Input full label="Full name" value={f.full_name} onChange={set("full_name")} required />
            <Input label="Gender"><select className="input" value={f.gender} onChange={set("gender")} required><option value="">Choose…</option><option>Female</option><option>Male</option><option>Other</option></select></Input>
            <Input label="Date of birth" type="date" value={f.date_of_birth} onChange={set("date_of_birth")} />
            <Input label="Phone" value={f.phone} onChange={set("phone")} />
            <Input label="Blood group"><select className="input" value={f.blood_group} onChange={set("blood_group")}><option value="" />{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b}>{b}</option>)}</select></Input>
            <Input full label="Home address" value={f.address} onChange={set("address")} />
            <Input label="Next of kin" value={f.next_of_kin} onChange={set("next_of_kin")} />
            <Input label="Next of kin phone" value={f.next_of_kin_phone} onChange={set("next_of_kin_phone")} />
            <Input full label="Known allergies"><textarea className="input" rows={2} value={f.allergies} onChange={set("allergies")} /></Input>
          </div>
        )}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || (mode === "existing" && !pid)}>{busy ? "Opening…" : "Start consultation"}</button></div>
      </form>
    </Modal>
  );
}
