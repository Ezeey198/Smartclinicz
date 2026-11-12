import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Notice, Pill } from "../../components/ui";

// The five default roles are always on. The admin can switch the optional ones on or off (a role with staff cannot be switched off).
export default function RoleSettings({ onChanged }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/clinic/role-settings").then((r) => setS(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);
  if (!s || s.optional.length === 0) return msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null;
  const toggle = async (role) => {
    const on = s.optional.filter((r) => r.enabled).map((r) => r.value);
    const next = on.includes(role.value) ? on.filter((v) => v !== role.value) : [...on, role.value];
    try { const r = await api.put("/clinic/role-settings", { extra_roles: next }); setS(r.data); setMsg(null); onChanged?.(); }
    catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  return (
    <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
      <b>Roles for this clinic</b>
      <div className="sub" style={{ margin: "4px 0 10px" }}>These five roles are included with every clinic and follow the Class B patient journey.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{s.defaults.map((r) => <Pill key={r.value} tone="green">{r.label}</Pill>)}</div>
      <div className="sub" style={{ marginBottom: 6 }}>Optional roles. Switch on only the ones you need:</div>
      {s.optional.map((r) => (
        <label key={r.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer" }}>
          <input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} style={{ marginTop: 4 }} />
          <span><b>{r.label}</b>{r.people > 0 && <span className="sub"> ({r.people} {r.people === 1 ? "person" : "people"})</span>}<div className="sub">{r.description}</div></span>
        </label>
      ))}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}
