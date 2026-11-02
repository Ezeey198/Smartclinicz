import { useState } from "react";
import CaseList from "../../components/cases/CaseList";
import CaseViewModal from "../../components/cases/CaseViewModal";

// Class B: the admin sees every patient journey, where it is now, who handled each step and when, and the money.
export default function Cases() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <CaseList title="Case tracking" sub="Every patient from reception to payment: current stage, who did each step, and the bill." strip
        tabs={[{ key: "all", label: "All", stages: ["*"] }, { key: "doc", label: "With doctor", stages: ["with_doctor", "back_to_doctor"] }, { key: "lab", label: "At the lab", stages: ["at_lab"] },
          { key: "ph", label: "At the pharmacy", stages: ["at_pharmacy"] }, { key: "pay", label: "Awaiting payment", stages: ["awaiting_payment"] }, { key: "done", label: "Completed", stages: ["completed"] }]}
        empty="No cases yet. They appear when the doctor receives a patient." onOpen={(c) => setOpen(c.id)} />
      {open && <CaseViewModal caseId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
