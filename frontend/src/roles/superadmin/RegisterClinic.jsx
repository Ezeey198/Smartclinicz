import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Band, Input, Modal, Notice } from "../../components/ui";

const blank = { clinic_class: "B", name: "", registration_number: "", license_number: "", email: "", phone: "", website: "", address: "", city: "",
  district: "", country: "", description: "", admin_name: "", admin_email: "", admin_phone: "" };

export default function RegisterClinic({ onClose, onDone }) {
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const { data } = await api.post("/superadmin/clinics", f); onDone(data); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Register a clinic" onClose={onClose} wide>
      <form onSubmit={submit}>
        <p className="group-title">Clinic class</p>
        <div className="class-pick">
          {[["A", "Class A: full service", "Every clinic role: doctors, nurses, lab, pharmacy, reception, billing, radiology, records, stores and HR."],
            ["B", "Class B: essential", "Admin, doctor, nurse, lab technician and pharmacist only."]].map(([v, t, d]) => (
            <label key={v} className={f.clinic_class === v ? "on" : ""}>
              <input type="radio" name="cls" checked={f.clinic_class === v} onChange={() => setF({ ...f, clinic_class: v })} />
              <Band code={`CL${v}`} cls={v} /><strong>{t}</strong><small>{d}</small>
            </label>
          ))}
        </div>
        <p className="group-title">Clinic details</p>
        <div className="grid2">
          <Input full label="Clinic name" value={f.name} onChange={set("name")} required />
          <Input label="Registration number" value={f.registration_number} onChange={set("registration_number")} />
          <Input label="Health licence number" value={f.license_number} onChange={set("license_number")} />
          <Input label="Clinic email" type="email" value={f.email} onChange={set("email")} required />
          <Input label="Clinic phone" value={f.phone} onChange={set("phone")} required />
          <Input full label="Street address" value={f.address} onChange={set("address")} required />
          <Input label="Town or city" value={f.city} onChange={set("city")} required />
          <Input label="District or region" value={f.district} onChange={set("district")} />
          <Input label="Country" value={f.country} onChange={set("country")} required />
          <Input label="Website" value={f.website} onChange={set("website")} />
          <Input full label="About the clinic"><textarea className="input" rows={2} value={f.description} onChange={set("description")} /></Input>
        </div>
        <p className="group-title">Clinic admin</p>
        <div className="grid2">
          <Input label="Full name" value={f.admin_name} onChange={set("admin_name")} required />
          <Input label="Email" type="email" value={f.admin_email} onChange={set("admin_email")} required hint="Approval emails go here." />
          <Input label="Phone" value={f.admin_phone} onChange={set("admin_phone")} />
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Registering…" : "Register clinic"}</button></div>
      </form>
    </Modal>
  );
}

