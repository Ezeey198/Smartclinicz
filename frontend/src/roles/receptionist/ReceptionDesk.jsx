import { useState } from "react";
import { UserPlus } from "lucide-react";
import CaseList from "../../components/cases/CaseList";
import CaseViewModal from "../../components/cases/CaseViewModal";
import OpenCaseModal from "../../components/cases/OpenCaseModal";

// The receptionist receives the patient: records them (or finds the existing record), enters the email for their patient page, and assigns an available doctor.
export default function ReceptionDesk() {
  const [register, setRegister] = useState(false);
  const [open, setOpen] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <CaseList title="Reception desk" sub="Receive each patient, then assign them to an available doctor. A returning patient keeps their record and gets the next visit number." reloadKey={k}
        actions={<button className="btn primary" onClick={() => setRegister(true)}><UserPlus size={16} />Receive a patient</button>}
        tabs={[{ key: "wait", label: "Waiting for a doctor", stages: ["awaiting_doctor"] }, { key: "now", label: "In progress", stages: ["with_doctor", "at_lab", "back_to_doctor", "at_pharmacy", "awaiting_payment"] },
          { key: "done", label: "Completed", stages: ["completed"] }, { key: "all", label: "All", stages: ["*"] }]}
        empty="No patients received yet." onOpen={(c) => setOpen(c.id)} />
      {register && <OpenCaseModal reception onClose={() => setRegister(false)} onDone={() => { setRegister(false); setK(k + 1); }} />}
      {open && <CaseViewModal caseId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
