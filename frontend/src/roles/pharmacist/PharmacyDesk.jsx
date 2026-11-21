import { useState } from "react";
import CaseList from "../../components/cases/CaseList";
import PharmacyCaseModal from "../../components/cases/PharmacyCaseModal";

// Class B: the pharmacist sells the drugs, records every detail of the money, and produces the single final bill.
export default function PharmacyDesk() {
  const [open, setOpen] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <CaseList title="Pharmacy desk" sub="Patients sent by the doctor. Sell the drugs, generate the one bill, take payment." reloadKey={k}
        tabs={[{ key: "serve", label: "To serve", stages: ["at_pharmacy"] }, { key: "pay", label: "Awaiting payment", stages: ["awaiting_payment"] },
          { key: "done", label: "Completed", stages: ["completed"] }, { key: "other", label: "Still with doctor or lab", stages: ["with_doctor", "at_lab", "back_to_doctor"] }, { key: "all", label: "All", stages: ["*"] }]}
        empty="No patients have been sent to the pharmacy yet." onOpen={(c) => setOpen(c.id)} />
      {open && <PharmacyCaseModal caseId={open} onClose={() => { setOpen(null); setK(k + 1); }} />}
    </>
  );
}
