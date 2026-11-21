import { useState } from "react";
import { Band, Modal, Notice, Pill } from "../../components/ui";

export default function EmailResult({ clinic, emails, onClose }) {
  const [copied, setCopied] = useState("");
  const failed = emails.filter((e) => !e.sent);
  const copy = async (l) => { try { await navigator.clipboard.writeText(l); setCopied(l); } catch { /* clipboard blocked */ } };
  const reason = (e) => e.error || "email sending is not set up (SMTP_HOST is empty in backend/.env)";
  return (
    <Modal title={clinic.name} onClose={onClose}>
      <div className="detail-top"><Band code={clinic.code} cls={clinic.clinic_class} size="lg" /><span className="sub">This clinic's code</span></div>
      {failed.length === 0
        ? <Notice tone="success">Both emails were sent to {clinic.admin?.email}.</Notice>
        : <Notice tone="error">{failed.length === emails.length ? "No email was delivered" : "Some emails were not delivered"} to {clinic.admin?.email}: {reason(failed[0])}.
            Use the links below yourself or send them to the admin. They are also kept in the Email outbox.</Notice>}
      {emails.map((e) => (
        <div className="mailrow" key={e.link}>
          <div><b>{e.subject}</b> <Pill tone={e.sent ? "green" : "coral"}>{e.sent ? "Sent" : "Not sent"}</Pill></div>
          <div className="linkbox"><a href={e.link} target="_blank" rel="noreferrer">{e.link}</a>
            <button className="btn sm ghost" onClick={() => copy(e.link)}>{copied === e.link ? "Copied" : "Copy link"}</button></div>
        </div>))}
      <div className="modal-foot"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
