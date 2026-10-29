import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Plus } from "lucide-react";
import { Band, Empty, Notice, PageHead, Pill, Spinner, fmtDate } from "../../components/ui";
import { statusPill } from "./statusPill";
import RegisterClinic from "./RegisterClinic";
import ClinicDetail from "./ClinicDetail";
import EmailResult from "./EmailResult";

export default function Clinics() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [reg, setReg] = useState(false);
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null);
  const load = () => api.get("/superadmin/clinics").then((r) => { setRows(r.data); setSel((s) => s && r.data.find((c) => c.id === s.id)); });
  useEffect(() => { load(); }, []);

  const act = async (fn, ok) => { try { await fn(); setMsg({ tone: "success", text: ok }); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } };
  const resend = async () => {
    const c = sel;
    try { const { data } = await api.post(`/superadmin/clinics/${c.id}/resend`); setSel(null); setResult({ clinic: c, emails: data.emails }); load(); }
    catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  const list = (rows || []).filter((c) => `${c.name} ${c.code} ${c.city} ${c.admin?.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="Clinics" sub="Register clinics and keep track of their approval."><button className="btn primary" onClick={() => setReg(true)}><Plus size={16} />Register a clinic</button></PageHead>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="toolbar"><input className="input search" placeholder="Search by name, code, city or admin email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel">
        {!rows ? <Spinner /> : list.length === 0 ? <Empty text={rows.length ? "No clinics match your search." : "No clinics yet. Register the first one."} /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Clinic</th><th>Code</th><th>Admin</th><th>Clinic</th><th>Admin account</th><th /></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.id} className="click" onClick={() => setSel(c)}>
                <td><b>{c.name}</b><div className="sub">{[c.city, c.country].filter(Boolean).join(", ")}</div></td>
                <td><Band code={c.code} cls={c.clinic_class} /></td>
                <td>{c.admin?.full_name}<div className="sub">{c.admin?.email}</div></td>
                <td>{statusPill(c.status)}</td>
                <td>{c.admin && <Pill tone={c.admin.is_active ? "green" : "amber"}>{c.admin.is_active ? "Active" : "Awaiting activation"}</Pill>}</td>
                <td className="sub">{fmtDate(c.created_at)}</td>
              </tr>))}</tbody></table></div>
        )}
      </div>
      {reg && <RegisterClinic onClose={() => setReg(false)} onDone={(c) => { setReg(false); setResult({ clinic: c, emails: c.emails }); load(); }} />}
      {result && <EmailResult clinic={result.clinic} emails={result.emails} onClose={() => setResult(null)} />}
      {sel && <ClinicDetail sel={sel} setSel={setSel} act={act} onResend={resend} onClose={() => setSel(null)} />}
    </>
  );
}

