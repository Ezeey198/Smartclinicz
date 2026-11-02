import { useState } from "react";
import { UserPlus } from "lucide-react";
import CaseList from "../../components/cases/CaseList";
import DoctorCaseModal from "../../components/cases/DoctorCaseModal";
import OpenCaseModal from "../../components/cases/OpenCaseModal";

// Class B: the doctor receives the patient, consults, then sends them to the lab and/or the pharmacy.
export default function PatientDesk() {
  const [open, setOpen] = useState(null);
  const [receive, setReceive] = useState(false);
  const [k, setK] = useState(0);
  return (
    <>
      <CaseList title="Patient desk" sub="Receive patients, consult, and send them to the lab or the pharmacy. Results come back here." reloadKey={k}
        actions={<button className="btn primary" onClick={() => setReceive(true)}><UserPlus size={16} />Receive a patient</button>}
        tabs={[{ key: "mine", label: "Needs me", stages: ["with_doctor", "back_to_doctor"] }, { key: "lab", label: "At the lab", stages: ["at_lab"] },
          { key: "ph", label: "At the pharmacy", stages: ["at_pharmacy", "awaiting_payment"] }, { key: "done", label: "Completed", stages: ["completed"] }, { key: "all", label: "All", stages: ["*"] }]}
        empty="No patients yet. Receive the first patient." onOpen={(c) => setOpen(c.id)} />
      {receive && <OpenCaseModal onClose={() => setReceive(false)} onDone={(d) => { setReceive(false); setK(k + 1); setOpen(d.case.id); }} />}
      {open && <DoctorCaseModal caseId={open} onClose={() => { setOpen(null); setK(k + 1); }} />}
    </>
  );
}
