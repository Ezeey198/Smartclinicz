import DataPage from "../../components/DataPage";
import { priceColumns, priceFields } from "../../config/schemas";

export default function Prices() {
  return <DataPage module="prices" title="Price list" single="price" createLabel="Add price" empty="No prices yet. Add the first price."
    sub="Set what each service costs. When a patient is registered, booked, or a lab test, imaging exam or prescription is ordered, an invoice for that price is raised automatically."
    columns={priceColumns} fields={priceFields} />;
}
