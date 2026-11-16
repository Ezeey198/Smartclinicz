// The doctor receives a patient: pick someone already on record, or register a new patient on the spot.
import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice } from "../ui";

export default function OpenCaseModal({ onClose, onDone, reception = false, presetPatient = null, onOpenExisting }) {
  const [mode, setMode] = useState("existing");
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState(presetPatient ? `${presetPatient.full_name} (${presetPatient.patient_no})` : "");
  const [pid, setPid] = useState(presetPatient ? presetPatient.id : "");
  const [openNo, setOpenNo] = useState(null);       // the patient already has an open case: offer to open it
  const [f, setF] = useState({ full_name: "", gender: "", date_of_birth: "", phone: "", address: "", next_of_kin: "", next_of_kin_phone: "", blood_group: "", allergies: "", email: "" });
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/patients").then((r) => setPatients(r.data));
    if (reception) api.get("/cases/doctors").then((r) => { setDoctors(r.data); setDoctorId(r.data[0]?.id || ""); });
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const matches = q.trim() ? patients.filter((p) => `${p.full_name} ${p.patient_no} ${p.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOpenNo(null); setBusy(true);
    try {
      const body = mode === "existing" ? { patient_id: Number(pid), email: newEmail } : f;
      const { data } = await api.post(reception ? "/cases/register" : "/cases/open", reception ? { ...body, doctor_id: Number(doctorId) } : body);
      onDone(data);
    } catch (x) {
      const m = /\((CS-\d+)\)/.exec(errMsg(x));
      setErr(errMsg(x)); if (m && onOpenExisting) setOpenNo(m[1]);
    } finally { setBusy(false); }
  };
  const openExisting = async () => {
    try { const c = (await api.get("/cases")).data.find((x) => x.case_no === openNo); if (c) onOpenExisting(c.id); else setErr("That case could not be found."); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={reception ? "Receive and assign a patient" : "Receive a patient"} onClose={onClose} wide>
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
            {pid && <Input label="Patient email or attendant's email (optional, to open or update their patient page)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} hint="A returning patient can use the same email or a new one." />}
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
            <Input full label="Patient email or attendant's email" type="email" value={f.email} onChange={set("email")} hint="The patient gets a link to accept their patient page, follow each step of the visit and save the final document." />
          </div>
        )}
        {reception && (
          <Input full label="Assign to doctor" hint="Doctors with the fewest waiting patients are listed first.">
            <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              {doctors.length === 0 && <option value="">No doctor in this clinic</option>}
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name} ({d.open_cases} waiting)</option>)}
            </select>
          </Input>
        )}
        {err && <Notice tone="error">{err}</Notice>}
        {openNo && <p><button type="button" className="btn primary" onClick={openExisting}>Open case {openNo}</button></p>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || (mode === "existing" && !pid) || (reception && !doctorId)}>{busy ? "Saving…" : reception ? "Register and assign to doctor" : "Start consultation"}</button></div>
      </form>
    </Modal>
  );
}
