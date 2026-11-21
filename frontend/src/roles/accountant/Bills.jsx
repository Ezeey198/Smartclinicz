import { useState } from "react";
import CaseList from "../../components/cases/CaseList";
import PharmacyCaseModal from "../../components/cases/PharmacyCaseModal";

// With an accountant, the pharmacist stops at the billing record and sends it here. The accountant reviews it, receives the payment, stamps and prints.
export default function Bills() {
  const [open, setOpen] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <CaseList title="Patient bills" sub="Bills sent by the pharmacist. Review the payments, receive the money, stamp the case file and print it for the patient." reloadKey={k}
        tabs={[{ key: "pay", label: "To receive payment", stages: ["awaiting_payment"] }, { key: "done", label: "Paid and completed", stages: ["completed"] }, { key: "all", label: "All", stages: ["*"] }]}
        empty="No bills have been sent yet." onOpen={(c) => setOpen(c.id)} />
      {open && <PharmacyCaseModal caseId={open} onClose={() => { setOpen(null); setK(k + 1); }} />}
    </>
  );
}
