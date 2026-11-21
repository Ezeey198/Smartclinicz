import { useState } from "react";
import CaseList from "../../components/cases/CaseList";
import CaseViewModal from "../../components/cases/CaseViewModal";

export default function Cases() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <CaseList title="Patient cases" sub="Where each patient is in the clinic right now (view only)."
        tabs={[{ key: "now", label: "In progress", stages: ["with_doctor", "at_lab", "back_to_doctor", "at_pharmacy", "awaiting_payment"] }, { key: "done", label: "Completed", stages: ["completed"] }]}
        empty="No cases yet." onOpen={(c) => setOpen(c.id)} />
      {open && <CaseViewModal caseId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
