import { useState } from "react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice } from "../../components/ui";

export default function StaffForm({ u, me, roles, onClose, onDone }) {
  const isNew = !u.id;
  const [f, setF] = useState({ full_name: u.full_name || "", email: u.email || "", phone: u.phone || "", role: u.role || roles[1]?.value || "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (isNew) { const r = await api.post("/clinic/users", f); onDone("Account created.", r.data.email); }
      else { await api.patch(`/clinic/users/${u.id}`, { full_name: f.full_name, phone: f.phone, role: f.role }); onDone("Changes saved."); }
    } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={isNew ? "Add staff member" : "Edit staff member"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input full label="Full name" value={f.full_name} onChange={set("full_name")} required />
          <Input label="Email" type="email" value={f.email} onChange={set("email")} required disabled={!isNew} />
          <Input label="Phone" value={f.phone} onChange={set("phone")} />
          <Input full label="Role" hint={roles.find((r) => r.value === f.role)?.description}><select className="input" value={f.role} onChange={set("role")} disabled={me}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Input>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">{isNew ? "Create and send activation email" : "Save changes"}</button></div>
      </form>
    </Modal>
  );
}
