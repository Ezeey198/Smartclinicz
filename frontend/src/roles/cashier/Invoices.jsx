import { useState } from "react";
import DataPage from "../../components/DataPage";
import PayModal from "../../components/PayModal";
import { invoiceColumns, invoiceRaiseFields } from "../../config/schemas";

export default function Invoices() {
  const [pay, setPay] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} module="billing" title="Invoices" single="invoice" createLabel="Walk-in invoice" empty="No invoices yet."
        sub="Receive payments against open invoices." columns={invoiceColumns} fields={invoiceRaiseFields} statuses={["unpaid", "partial", "paid"]}
        tabs={[{ key: "open", label: "Open", filter: (r) => r.status !== "paid" }, { key: "paid", label: "Paid", filter: (r) => r.status === "paid" }]}
        rowActions={(r) => r.status !== "paid" ? [{ label: "Receive payment", tone: "primary", onClick: () => setPay(r) }] : []} />
      {pay && <PayModal invoice={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); setK(k + 1); }} />}
    </>
  );
}
