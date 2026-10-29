// Full patient history in one place: visits, appointments, lab, prescriptions, imaging.
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import api, { errMsg } from "../api";
import { Empty, Notice, PageHead, Pill, Spinner, fmtDate } from "./ui";

const SECTIONS = [
  ["visits", "Consultations", [["created_at", "Date", "d"], ["complaints", "Complaints"], ["diagnosis", "Diagnosis"], ["treatment_notes", "Treatment"], ["recorded_by", "By"]]],
  ["appointments", "Appointments", [["scheduled_at", "When", "t"], ["doctor_name", "Doctor"], ["reason", "Reason"], ["status", "Status", "p"]]],
  ["lab", "Laboratory", [["created_at", "Date", "d"], ["test_name", "Test"], ["result", "Result"], ["status", "Status", "p"]]],
  ["pharmacy", "Prescriptions", [["created_at", "Date", "d"], ["drug", "Drug"], ["dosage", "Dosage"], ["duration", "Duration"], ["status", "Status", "p"]]],
  ["imaging", "Imaging", [["created_at", "Date", "d"], ["exam_type", "Exam"], ["body_part", "Area"], ["findings", "Report"], ["status", "Status", "p"]]],
];

export default function PatientFile() {
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/patients").then((r) => setPatients(r.data)).catch((e) => setErr(errMsg(e))); }, []);

  const open = async (id) => {
    setFile(null); setErr("");
    try { setFile((await api.get(`/records/patient/${id}`)).data); } catch (e) { setErr(errMsg(e)); }
  };
  const matches = q.trim() ? patients.filter((p) => `${p.full_name} ${p.patient_no} ${p.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const p = file?.patient;

  return (
    <>
      <PageHead title="Patient files" sub="Search for a patient to see everything recorded about them.">
        {file && <button className="btn ghost" onClick={() => window.print()}><Printer size={16} />Print</button>}
      </PageHead>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="no-print">
        <input className="input search" placeholder="Search by name, patient number or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        {matches.length > 0 && <div className="panel picks">{matches.map((m) => (
          <button key={m.id} onClick={() => { open(m.id); setQ(""); }}><b>{m.full_name}</b><span className="sub">{m.patient_no} · {m.phone}</span></button>))}</div>}
      </div>
      {!file && !err && <div className="panel" style={{ marginTop: 16 }}><Empty text="No patient selected yet." /></div>}
      {p && (
        <>
          <div className="panel pad" style={{ marginTop: 16 }}>
            <h2>{p.full_name}</h2>
            <dl className="facts" style={{ marginTop: 12 }}>
              <dt>Patient no.</dt><dd>{p.patient_no}</dd><dt>Gender</dt><dd>{p.gender}</dd><dt>Date of birth</dt><dd>{p.date_of_birth || "—"}</dd>
              <dt>Phone</dt><dd>{p.phone || "—"}</dd><dt>Blood group</dt><dd>{p.blood_group || "—"}</dd><dt>Allergies</dt><dd>{p.allergies || "None recorded"}</dd>
              <dt>Next of kin</dt><dd>{[p.next_of_kin, p.next_of_kin_phone].filter(Boolean).join(" · ") || "—"}</dd>
            </dl>
          </div>
          {SECTIONS.filter(([k]) => file[k]).map(([k, title, cols]) => (
            <div key={k}>
              <h3 className="section">{title}</h3>
              <div className="panel">
                {file[k].length === 0 ? <Empty text={`No ${title.toLowerCase()} recorded.`} /> : (
                  <div className="scroll"><table className="table"><thead><tr>{cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
                    <tbody>{file[k].map((r) => <tr key={r.id}>{cols.map(([c, l, t]) => (
                      <td key={l}>{t === "p" ? <Pill value={r[c]} /> : t === "d" ? fmtDate(r[c]) : t === "t" ? (r[c] || "").replace("T", " ") : r[c]}</td>))}</tr>)}</tbody></table></div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
