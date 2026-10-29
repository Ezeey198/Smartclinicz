import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Pill, Spinner, fmtDate } from "../../components/ui";

const STATE = { active: ["green", "Active"], pending: ["amber", "Awaiting activation"], inactive: ["gray", "Deactivated"] };

export default function StaffDirectory() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/hr/staff").then((r) => setRows(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!rows) return <Spinner />;
  const shown = rows.filter((r) => `${r.full_name} ${r.email} ${r.role_label}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Staff directory" sub="Everyone with an account at this clinic. Accounts are managed by the clinic admin." />
      <div className="toolbar"><input className="input search" placeholder="Search by name, email or role" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel">
        {shown.length === 0 ? <Empty text="No staff match your search." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Account</th><th>Added</th></tr></thead>
            <tbody>{shown.map((u) => <tr key={u.id}><td><b>{u.full_name}</b><div className="sub">{u.email}</div></td><td>{u.role_label}</td><td>{u.phone}</td>
              <td><Pill tone={STATE[u.state][0]}>{STATE[u.state][1]}</Pill></td><td className="sub">{fmtDate(u.joined)}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}
