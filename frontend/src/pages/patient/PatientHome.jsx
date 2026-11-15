import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Download, LogOut } from "lucide-react";
import { errMsg } from "../../api";
import { Notice, Pill, Spinner, fmtStamp } from "../../components/ui";
import { store } from "../../storage";
import PatientDocument from "./PatientDocument";
import portal, { PATIENT_TOKEN } from "./portalApi";

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// The patient's page. It follows the visit from reception to payment, shows a message for every step, and hands over the final stamped document.
// After the patient saves the PDF, an alert counts five minutes and the session then ends.
export default function PatientHome() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [notes, setNotes] = useState([]);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [endsAt, setEndsAt] = useState(null);
  const [left, setLeft] = useState(null);
  const leave = () => { store.del(PATIENT_TOKEN); nav("/patient?ended=1"); };
  const load = async () => {
    try {
      const { data } = await portal.get("/portal/me");
      setMe(data); setEndsAt(data.session_ends_at ? Date.parse(data.session_ends_at) : null);
      setNotes((await portal.get("/portal/notifications")).data);
      if (data.document_ready && !doc) setDoc((await portal.get("/portal/document")).data);
    } catch (e) { setErr(errMsg(e)); }
  };
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!endsAt) return undefined;
    const tick = () => { const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000)); setLeft(s); if (s === 0) leave(); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [endsAt]);

  const save = async () => {
    try { const { data } = await portal.post("/portal/document/saved"); setEndsAt(Date.parse(data.session_ends_at)); setTimeout(() => window.print(), 200); }   // choose "Save as PDF" in the print window
    catch (e) { setErr(errMsg(e)); }
  };
  if (!me) return err ? <div className="pub-wrap" style={{ padding: 30 }}><Notice tone="error">{err}</Notice></div> : <Spinner />;

  return (
    <div className="patient-page">
      <header className="patient-head no-print">
        <div><b>{me.clinic.name}</b><div className="sub">{me.patient.full_name} · {me.patient.patient_no}</div></div>
        <button className="btn ghost sm" onClick={leave}><LogOut size={15} />Sign out</button>
      </header>
      <div className="patient-body">
        {left !== null && <div className="no-print"><Notice tone="error">You saved your document. This page closes in <b>{mmss(left)}</b>. After that you can no longer sign in until your next visit.</Notice></div>}
        {err && <Notice tone="error">{err}</Notice>}
        <section className="panel pad no-print">
          <h3>{me.visit ? `Your visit${me.visit.visit_no ? ` (No. ${me.visit.visit_no})` : ""}` : "No visit yet"}</h3>
          {me.visit && <p style={{ margin: "6px 0" }}><Pill value={me.visit.stage}>{me.visit.stage_label}</Pill>{(me.visit.room || me.visit.bed) && <span className="sub"> · {[me.visit.room && `Room ${me.visit.room}`, me.visit.bed && `Bed ${me.visit.bed}`].filter(Boolean).join(" · ")}</span>}</p>}
          <ol className="steps">{me.steps.map((s, i) => <li key={i}><span>{s.step}</span><small>{fmtStamp(s.at)}</small></li>)}</ol>
          {me.steps.length === 0 && <p className="sub">Your steps will appear here as your visit moves along.</p>}
        </section>

        <section className="panel pad no-print">
          <h3><Bell size={16} /> Messages {me.unread > 0 && <span className="badge">{me.unread} new</span>}</h3>
          {notes.length === 0 ? <p className="sub">You will get a message here, and by SMS, at every new step.</p> : notes.map((n) => <div key={n.id} className="note"><b>{n.title}</b><span>{n.body}</span><small>{fmtStamp(n.created_at)}</small></div>)}
        </section>

        <section className="panel pad">
          <h3 className="no-print">Your final document</h3>
          {!doc ? <p className="sub no-print">When all your files are complete, paid and stamped, your document appears here as a PDF you can save.</p> : (
            <>
              <div className="no-print" style={{ marginBottom: 12 }}><button className="btn primary" onClick={save}><Download size={16} />Save as PDF to my device</button>
                <p className="hint">In the window that opens, choose “Save as PDF”. Your page closes five minutes after you save.</p></div>
              <PatientDocument doc={doc} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
