import { useState } from "react";
import DataPage from "../../components/DataPage";
import PayModal from "../../components/PayModal";
import { invoiceColumns, invoiceFields } from "../../config/schemas";

export default function Invoices() {
  const [pay, setPay] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} module="billing" title="Invoices" single="invoice" createLabel="New invoice" empty="No invoices yet."
        sub="All invoices. Edit amounts, or record a payment." columns={invoiceColumns} fields={invoiceFields} statuses={["unpaid", "partial", "paid"]}
        rowActions={(r) => r.status !== "paid" ? [{ label: "Receive payment", onClick: () => setPay(r) }] : []} />
      {pay && <PayModal invoice={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); setK(k + 1); }} />}
    </>
  );
}
