import { useState } from "react";
import api, { errMsg } from "../api";
import { Input, Modal, Notice, label } from "./ui";

const opt = (o) => (typeof o === "string" ? { value: o, label: label(o) } : o);

export default function FormModal({ module, single, fields, defaults = {}, row, readOnly, lists, onClose, onDone }) {
  const isNew = !row.id;
  const init = {};
  fields.forEach((f) => {
    const v = row[f.name] ?? defaults[f.name] ?? (f.name === "status" && f.options ? opt(f.options[0]).value : "");
    init[f.name] = typeof v === "boolean" ? (v ? "yes" : "no") : v;
  });
  const [f, setF] = useState(init);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { isNew ? await api.post(`/${module}`, f) : await api.patch(`/${module}/${row.id}`, f); onDone(); } catch (x) { setErr(errMsg(x)); }
  };

  const control = (x) => {
    const val = f[x.name];
    if (x.type === "textarea") return <textarea className="input" rows={3} value={val} onChange={set(x.name)} />;
    const pick = (options, placeholder, required) => (
      <select className="input" value={val} onChange={set(x.name)} required={required}>
        <option value="">{placeholder}</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>);
    if (x.type === "select") return pick(x.options.map(opt), x.required ? "Choose…" : "", x.required);
    if (x.type === "patient") return pick(lists.patients.map((p) => ({ value: p.id, label: `${p.full_name} (${p.patient_no})` })), "Choose a patient…", true);
    if (x.type === "doctor") return pick(lists.doctors.map((d) => ({ value: d.full_name, label: d.full_name })), "Any doctor");
    if (x.type === "staff") return pick(lists.staff.map((s) => ({ value: s.id, label: `${s.full_name} (${s.role_label})` })), "Choose a staff member…", true);
    return <input className="input" type={x.type === "number" ? "number" : x.type || "text"} step={x.type === "number" ? "any" : undefined} value={val} onChange={set(x.name)} required={x.required} />;
  };

  return (
    <Modal title={readOnly ? `View ${single}` : `${isNew ? "New" : "Edit"} ${single}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <fieldset disabled={readOnly}>
          <div className="grid2">
            {fields.filter((x) => !(x.editOnly && isNew)).map((x) => <Input key={x.name} label={x.label} full={x.full}>{control(x)}</Input>)}
          </div>
        </fieldset>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button className="btn primary">Save {single}</button>}
        </div>
      </form>
    </Modal>
  );
}
