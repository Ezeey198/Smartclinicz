import { useEffect, useState } from "react";
import { Pencil, Plus, Power, Send, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import { Empty, Notice, PageHead, Pill, Spinner } from "../../components/ui";
import StaffForm from "./StaffForm";

const STATE = { active: ["green", "Active"], pending: ["amber", "Awaiting activation"], inactive: ["gray", "Deactivated"] };

export default function Staff() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [roles, setRoles] = useState([]);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/clinic/users").then((r) => setRows(r.data));
  useEffect(() => { load(); api.get("/clinic/roles").then((r) => setRoles(r.data)); }, []);
  // After an email-sending action, say plainly if the email did not go out and show the link to share by hand.
  const withMail = (ok, m) => (m && !m.sent
    ? { tone: "error", text: `${ok} But the email to ${m.to} was not sent (${m.error || "email sending is not set up"}). Give them this link:`, link: m.link }
    : { tone: "success", text: m ? `${ok} An email was sent to ${m.to}.` : ok });
  const act = async (fn, ok) => { try { const r = await fn(); setMsg(withMail(ok, r?.data?.email)); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } };
  if (!rows) return <Spinner />;
  const cls = user.clinic.clinic_class;

  return (
    <>
      <PageHead title="Staff" sub="Create accounts for your team and choose their roles."><button className="btn primary" onClick={() => setEdit({})}><Plus size={16} />Add staff member</button></PageHead>
      <Notice>Class {cls} clinic: {roles.length} roles available. New accounts stay inactive until the person opens the emailed link and sets a password.</Notice>
      {msg && <Notice tone={msg.tone}>{msg.text}{msg.link && <> <a href={msg.link}>{msg.link}</a></>}</Notice>}
      <div className="panel">
        {rows.length === 0 ? <Empty text="No staff yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((u) => {
              const me = u.id === user.id;
              return (
                <tr key={u.id}>
                  <td><b>{u.full_name}{me && " (you)"}</b><div className="sub">{u.email}</div></td><td>{u.role_label}</td><td>{u.phone}</td>
                  <td><Pill tone={STATE[u.state][0]}>{STATE[u.state][1]}</Pill></td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Edit" onClick={() => setEdit(u)}><Pencil size={16} /></button>
                    <button className="icon-btn" title={u.state === "active" ? "Send password link" : "Resend activation link"} onClick={() => act(() => api.post(`/clinic/users/${u.id}/resend`), "Link sent.")}><Send size={16} /></button>
                    {!me && <button className="icon-btn" title={u.state === "active" ? "Deactivate" : "Reactivate"} onClick={() => act(() => api.post(`/clinic/users/${u.id}/toggle`), u.state === "active" ? "Account deactivated." : "Account reactivated.")}><Power size={16} /></button>}
                    {!me && <button className="icon-btn danger" title="Delete" onClick={() => window.confirm(`Delete ${u.full_name}?`) && act(() => api.delete(`/clinic/users/${u.id}`), "Account deleted.")}><Trash2 size={16} /></button>}
                  </td>
                </tr>);
            })}</tbody></table></div>
        )}
      </div>
      {edit && <StaffForm u={edit} me={edit.id === user.id} roles={roles} onClose={() => setEdit(null)}
        onDone={(t, m) => { setEdit(null); setMsg(withMail(t, m)); load(); }} />}
    </>
  );
}

