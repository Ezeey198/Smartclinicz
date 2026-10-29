import { PauseCircle, PlayCircle, Send, Trash2 } from "lucide-react";
import api from "../../api";
import { Band, Modal, fmtDateTime } from "../../components/ui";
import { statusPill } from "./statusPill";

export default function ClinicDetail({ sel, setSel, act, onClose, onResend }) {
  return (
<Modal title={sel.name} onClose={() => setSel(null)}>
          <div className="detail-top"><Band code={sel.code} cls={sel.clinic_class} size="lg" />{statusPill(sel.status)}</div>
          <dl className="facts">
            <dt>Class</dt><dd>{sel.clinic_class === "A" ? "Class A (full service)" : "Class B (essential)"}</dd>
            <dt>Registration</dt><dd>{sel.registration_number || "—"}</dd><dt>Licence</dt><dd>{sel.license_number || "—"}</dd>
            <dt>Contact</dt><dd>{sel.email}<br />{sel.phone}</dd>
            <dt>Address</dt><dd>{[sel.address, sel.city, sel.district, sel.country].filter(Boolean).join(", ")}</dd>
            <dt>Admin</dt><dd>{sel.admin?.full_name}<br />{sel.admin?.email}</dd>
            <dt>Staff accounts</dt><dd>{sel.user_count}</dd>
            <dt>Approved</dt><dd>{sel.approved_at ? fmtDateTime(sel.approved_at) : "Not yet"}</dd>
          </dl>
          <div className="modal-foot spread">
            <button className="btn danger" onClick={() => window.confirm(`Delete ${sel.name} and all of its data? This cannot be undone.`) && act(() => api.delete(`/superadmin/clinics/${sel.id}`).then(() => setSel(null)), "Clinic deleted.")}><Trash2 size={16} />Delete</button>
            <div className="row">
              {(sel.status === "pending" || !sel.admin?.is_active) && <button className="btn ghost" onClick={onResend}><Send size={16} />Resend emails</button>}
              {sel.approved_at && (sel.status === "active"
                ? <button className="btn ghost" onClick={() => act(() => api.post(`/superadmin/clinics/${sel.id}/status`, { status: "suspended" }), "Clinic suspended.")}><PauseCircle size={16} />Suspend</button>
                : <button className="btn primary" onClick={() => act(() => api.post(`/superadmin/clinics/${sel.id}/status`, { status: "active" }), "Clinic reactivated.")}><PlayCircle size={16} />Reactivate</button>)}
            </div>
          </div>
        </Modal>
  );
}
