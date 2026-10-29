import DataPage from "../../components/DataPage";
import { invoiceColumns, invoiceRaiseFields } from "../../config/schemas";

export default function Invoices() {
  return <DataPage module="billing" title="Invoices" single="invoice" createLabel="Raise invoice" empty="No invoices yet."
    sub="Raise a bill for a patient. Payments are taken by the cashier." columns={invoiceColumns} fields={invoiceRaiseFields} statuses={["unpaid", "partial", "paid"]} />;
}
