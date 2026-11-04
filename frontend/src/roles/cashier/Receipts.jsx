import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { receiptColumns } from "../../config/schemas";

export default function Receipts() {
  return <DataPage docBuilder={DOCS.receipt} module="billing" endpoint="/billing/payments" title="Receipts" single="receipt" readOnly empty="No payments received yet."
    sub="Every payment recorded at this clinic." columns={receiptColumns} />;
}
