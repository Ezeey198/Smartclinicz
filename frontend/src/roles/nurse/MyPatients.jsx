import { useState } from "react";
import CaseList from "../../components/cases/CaseList";
import CaseViewModal from "../../components/cases/CaseViewModal";
import { useAuth } from "../../auth";

// The patients the doctor has assigned to this nurse, with their room and bed.
export default function MyPatients() {
  const { user } = useAuth();
  const [open, setOpen] = useState(null);
  return (
    <>
      <CaseList title="My patients" sub="Patients the doctor assigned to you, with their room and bed." rowFilter={(r) => r.nurse_id === user.id}
        tabs={[{ key: "now", label: "Current", stages: ["awaiting_doctor", "with_doctor", "at_lab", "back_to_doctor", "at_pharmacy", "awaiting_payment"] }, { key: "done", label: "Completed", stages: ["completed"] }]}
        empty="No patients are assigned to you right now." onOpen={(c) => setOpen(c.id)} />
      {open && <CaseViewModal caseId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
