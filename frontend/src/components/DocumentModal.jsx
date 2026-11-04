// A printable document with the clinic letterhead. Each person who stamps it adds the clinic stamp with the date of that moment and their own name underneath.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, Stamp as StampIcon } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import { STAMPERS } from "../config/documents";
import Stamp, { fmtStampDate } from "./Stamp";
import { Modal, Notice, Spinner } from "./ui";

export default function DocumentModal({ doc, onClose }) {
  const { user } = useAuth();
  const [clinic, setClinic] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [uses, setUses] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const loadUses = () => api.get("/stamps/uses", { params: { doc_type: doc.type, doc_id: doc.id } }).then((r) => setUses(r.data));
  useEffect(() => {
    api.get("/clinic/profile").then((r) => setClinic(r.data));
    api.get("/stamps/clinic").then((r) => setStamp(r.data));
    loadUses();
  }, []);

  const canStamp = user.role === "admin" || (STAMPERS[doc.type] || []).includes(user.role);
  const apply = async () => {
    setBusy(true); setErr("");
    try { await api.post("/stamps/apply", { doc_type: doc.type, doc_id: doc.id, doc_ref: doc.ref }); await loadUses(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const mine = (uses || []).some((u) => u.user_name === user.full_name);

  return (
    <Modal title={doc.title} onClose={onClose} wide>
      {!clinic || !stamp || !uses ? <Spinner /> : (
        <>
          <div className="doc-actions no-print">
            {canStamp && stamp.has_stamp && (doc.ready === false
              ? <Notice>{doc.readyNote}</Notice>
              : <button className="btn primary" onClick={apply} disabled={busy}><StampIcon size={16} />{mine ? "Stamp again" : "Stamp this document"}</button>)}
            <button className="btn ghost" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</button>
          </div>
          {!stamp.has_stamp && !doc.optionalStamp && <div className="no-print"><Notice tone="error">The clinic stamp has not been uploaded yet. {user.role === "admin" ? <Link to="/app/stamp" onClick={onClose}>Upload it now</Link> : "Ask the clinic admin to add it."}</Notice></div>}
          {err && <div className="no-print"><Notice tone="error">{err}</Notice></div>}
          {!canStamp && stamp.has_stamp && <div className="no-print"><Notice>Your role can print this document but not stamp it.</Notice></div>}

          <div className="doc-sheet print-area">
            <header className="doc-head">
              <h2>{clinic.name}</h2>
              <p>{[clinic.address, clinic.city, clinic.country].filter(Boolean).join(", ")}</p>
              <p>{[clinic.phone, clinic.email].filter(Boolean).join("  ·  ")}</p>
            </header>
            <div className="doc-title"><h3>{doc.title}</h3><span>{doc.ref}</span></div>
            <dl className="doc-meta">{doc.meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>)}</dl>
            {doc.sections.map((s, i) => (
              <section key={i}>
                {s.heading && <h4>{s.heading}</h4>}
                {s.table && (
                  <table className="doc-table"><thead><tr>{s.table.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{s.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c ?? "-"}</td>)}</tr>)}</tbody></table>
                )}
                {s.rows && <dl className="doc-rows">{s.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>)}</dl>}
                {s.text !== undefined && <p className="doc-text">{s.text || "-"}</p>}
              </section>
            ))}
            <footer className="doc-foot">
              <div className="stamps">
                {uses.length === 0 ? <p className="doc-unstamped">Not stamped yet</p> : uses.map((u) => (
                  <Stamp key={u.id} image={stamp.image} ink={stamp.ink} date={u.stamped_at} name={u.user_name} role={u.role_label} />))}
              </div>
              <p className="doc-printed">Printed {fmtStampDate()} by {user.full_name}</p>
            </footer>
          </div>
        </>
      )}
    </Modal>
  );
}
