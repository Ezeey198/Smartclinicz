// Role dashboards pass in which numbers, lists and shortcuts matter for them.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { Empty, PageHead, Pill, Spinner, money } from "./ui";

export default function StatDashboard({ intro, stats = [], list, listTitle, listKind = "appointments", links = [] }) {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/clinic/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <Spinner />;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const shown = stats.filter(([k]) => d[k] != null);
  const rows = list && d[list];

  return (
    <>
      <PageHead title={`${hello}, ${user.full_name.split(" ")[0]}`} sub={intro || `${user.clinic.name} · ${user.role_label}`} />
      {shown.length > 0 && <div className="strip">{shown.map(([k, l, kind]) => (
        <div key={k} className="strip-item"><b>{kind === "money" ? money(d[k]) : d[k]}</b><span>{l}</span></div>))}</div>}
      {rows && (
        <>
          <h3 className="section">{listTitle}</h3>
          <div className="panel">
            {rows.length === 0 ? <Empty text="Nothing here right now." /> : listKind === "stock" ? (
              <table className="table"><thead><tr><th>Item</th><th>In stock</th><th>Reorder at</th></tr></thead>
                <tbody>{rows.map((i) => <tr key={i.id}><td><b>{i.name}</b></td><td><Pill tone="coral">{i.quantity} {i.unit}</Pill></td><td>{i.reorder_level}</td></tr>)}</tbody></table>
            ) : (
              <table className="table"><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>{rows.map((a) => <tr key={a.id}><td><b>{a.time}</b></td><td>{a.patient_name}</td><td>{a.doctor_name}</td><td>{a.reason}</td><td><Pill value={a.status} /></td></tr>)}</tbody></table>
            )}
          </div>
        </>
      )}
      {links.length > 0 && (
        <>
          <h3 className="section">Your work</h3>
          <div className="quick">{links.filter(([, , , m]) => !m || user.modules?.[m]).map(([to, t, s]) => <Link key={to} to={to}>{t}<small>{s}</small></Link>)}</div>
        </>
      )}
    </>
  );
}
