import { useEffect } from "react";
import { X, Inbox } from "lucide-react";

const TONES = { scheduled: "amber", requested: "amber", pending: "amber", unpaid: "amber", partial: "blue", checked_in: "blue",
  in_progress: "blue", completed: "green", dispensed: "green", paid: "green", active: "green", cancelled: "coral",
  suspended: "coral", inactive: "gray", reported: "green", approved: "green", rejected: "coral" };
export const toneFor = (v) => TONES[v] || "gray";
export const label = (v) => (v ? String(v).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");
export const fmtDate = (s) => (s ? new Date(s + "Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtDateTime = (s) => (s ? new Date(s + "Z").toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
export const money = (n) => (n == null ? "" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

export const Pill = ({ value, tone, children }) => <span className={`pill ${tone || toneFor(value)}`}>{children || label(value)}</span>;

// The clinic code, styled like a hospital wristband: class letter + code.
export const Band = ({ code, cls, size }) => (
  <span className={`band ${cls === "B" ? "b" : ""} ${size || ""}`}><b>{cls}</b><span>{code}</span></span>
);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="actions">{children}</div></div>
);
export const Notice = ({ tone = "info", children }) => <div className={`notice ${tone}`}>{children}</div>;
export const Empty = ({ text, children }) => (
  <div className="empty"><Inbox size={28} /><p>{text}</p>{children}</div>
);
export const Spinner = () => <div className="splash"><div className="spin" /></div>;

export function Input({ label: l, full, hint, children, ...p }) {
  return (
    <label className={`fld ${full ? "full" : ""}`}>
      <span>{l}</span>
      {children || <input className="input" {...p} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export const ugx = (n) => `UGX ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
export const fmtLeft = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
};
export const fmtStamp = (s) => (s ? new Date(s.endsWith("Z") ? s : s + "Z").toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
