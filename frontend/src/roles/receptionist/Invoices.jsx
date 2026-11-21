import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { invoiceColumns, invoiceRaiseFields } from "../../config/schemas";

export default function Invoices() {
  return <DataPage docBuilder={DOCS.invoice} module="billing" title="Invoices" single="invoice" createLabel="Raise invoice" empty="No invoices yet."
    sub="Raise a bill for a patient. Payments are taken by the pharmacist or accountant." columns={invoiceColumns} fields={invoiceRaiseFields} statuses={["unpaid", "partial", "paid"]} />;
}
