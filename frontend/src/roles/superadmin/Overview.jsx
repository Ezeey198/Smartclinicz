import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Band, Empty, PageHead, Spinner } from "../../components/ui";
import { statusPill } from "./statusPill";

export default function Overview() {
  const [s, setS] = useState(null);
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/superadmin/stats").then((r) => setS(r.data)); api.get("/superadmin/clinics").then((r) => setRows(r.data.slice(0, 6))); }, []);
  if (!s) return <Spinner />;
  const cells = [["Clinics", s.clinics], ["Active", s.active], ["Awaiting approval", s.pending], ["Suspended", s.suspended], ["Class A", s.class_a], ["Class B", s.class_b], ["Clinic staff", s.users]];
  return (
    <>
      <PageHead title="Overview" sub="Every clinic registered on the system."><Link className="btn primary" to="/super/clinics"><Plus size={16} />Register a clinic</Link></PageHead>
      <div className="strip">{cells.map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      <h3 className="section">Recently registered</h3>
      <div className="panel">
        {rows.length === 0 ? <Empty text="No clinics yet. Register the first one." /> : (
          <table className="table"><thead><tr><th>Clinic</th><th>Code</th><th>Admin</th><th>Status</th></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.id}><td><b>{c.name}</b><div className="sub">{c.city}</div></td><td><Band code={c.code} cls={c.clinic_class} /></td>
              <td>{c.admin?.full_name}</td><td>{statusPill(c.status)}</td></tr>)}</tbody></table>
        )}
      </div>
    </>
  );
}

