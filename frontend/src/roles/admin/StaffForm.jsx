import { useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice } from "../../components/ui";

export default function StaffForm({ u, me, roles, onClose, onDone }) {
  const isNew = !u.id;
  const [f, setF] = useState({ full_name: u.full_name || "", email: u.email || "", phone: u.phone || "", qualification: u.qualification || "", job_title: u.job_title || "", role: u.role || roles[1]?.value || "" });
  const [extra, setExtra] = useState((u.roles || []).slice(1));
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      const more = extra.filter((x) => x !== f.role);
      if (isNew) { const r = await api.post("/clinic/users", { ...f, extra_roles: more }); onDone("Account created.", r.data.email); }
      else { await api.patch(`/clinic/users/${u.id}`, { full_name: f.full_name, phone: f.phone, qualification: f.qualification, job_title: f.job_title, roles: [f.role, ...more] }); onDone("Changes saved."); }
    } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={isNew ? "Add staff member" : "Edit staff member"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input full label="Full name" value={f.full_name} onChange={set("full_name")} required />
          <Input label="Email" type="email" value={f.email} onChange={set("email")} required disabled={!isNew} />
          <Input label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
          <Input label="Qualification" value={f.qualification} onChange={set("qualification")} hint="e.g. Diploma in Pharmacy" />
          <Input label="Job title" value={f.job_title} onChange={set("job_title")} />
          <Input full label="Role" hint={roles.find((r) => r.value === f.role)?.description}><select className="input" value={f.role} onChange={set("role")} disabled={me}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Input>
        </div>
        {roles.filter((r) => r.value !== f.role && r.value !== "admin").length > 0 && (
          <div className="fld full">
            <span>Also holds these roles (optional)</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {roles.filter((r) => r.value !== f.role && r.value !== "admin").map((r) => (
                <label key={r.value} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={extra.includes(r.value)} onChange={() => setExtra(extra.includes(r.value) ? extra.filter((x) => x !== r.value) : [...extra, r.value])} />{r.label}</label>))}
            </div>
            <small>Their sidebar is every chosen role's sidebar put together.</small>
          </div>)}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">{isNew ? "Create and send activation email" : "Save changes"}</button></div>
      </form>
    </Modal>
  );
}
