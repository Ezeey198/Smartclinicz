import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Pill, Spinner, fmtStamp, ugx } from "../ui";
import { EVENT_LABEL, STAGES, STAGE_LABEL } from "./meta";

// A list of cases with tabs. Each role page decides the tabs, the title and what happens when a case is opened.
export default function CaseList({ title, sub, tabs, onOpen, actions, reloadKey = 0, strip = false, empty = "No cases yet." }) {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState(tabs[0].key);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/cases").then((r) => setRows(r.data)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!rows) return <Spinner />;
  const cur = tabs.find((t) => t.key === tab);
  const shown = rows.filter((r) => cur.stages.includes("*") || cur.stages.includes(r.stage)).filter((r) => `${r.case_no} ${r.patient_name} ${r.doctor_name}`.toLowerCase().includes(q.toLowerCase()));
  const count = (t) => rows.filter((r) => t.stages.includes("*") || t.stages.includes(r.stage)).length;

  return (
    <>
      <PageHead title={title} sub={sub}>{actions}</PageHead>
      {strip && <div className="strip">{STAGES.map(([k, l]) => <div key={k} className="strip-item"><b>{rows.filter((r) => r.stage === k).length}</b><span>{l}</span></div>)}</div>}
      <div className="tabs-line" style={{ marginTop: strip ? 18 : 0 }}>
        {tabs.map((t) => <button key={t.key} className={t.key === tab ? "on" : ""} onClick={() => setTab(t.key)}>{t.label}<span>{count(t)}</span></button>)}
      </div>
      <div className="toolbar"><input className="input search" placeholder="Search by case number, patient or doctor" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel">
        {shown.length === 0 ? <Empty text={rows.length ? "No cases here right now." : empty} /> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>Case</th><th>Patient</th><th>Stage</th><th>Doctor</th><th>Bill</th><th>Last step</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="click" onClick={() => onOpen(r)}>
                <td><b>{r.case_no}</b><div className="sub">{fmtStamp(r.opened_at)}</div></td>
                <td>{r.patient_name}</td>
                <td><Pill value={r.stage}>{STAGE_LABEL[r.stage]}</Pill></td>
                <td>{r.doctor_name}</td>
                <td>{ugx(r.total)}<div className="sub">{r.invoice_status ? `Paid ${ugx(r.paid)}` : "Not billed yet"}</div></td>
                <td>{r.last_event ? (<>{EVENT_LABEL[r.last_event.kind] || r.last_event.kind}<div className="sub">{r.last_event.user_name} · {fmtStamp(r.last_event.created_at)}</div></>) : "-"}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
