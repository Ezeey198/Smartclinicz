import DataPage from "../../components/DataPage";
import { supplierColumns, supplierFields } from "../../config/schemas";

export default function Suppliers() {
  return <DataPage module="suppliers" title="Suppliers" single="supplier" createLabel="Add supplier" empty="No suppliers yet." sub="The wholesalers and distributors you buy from." columns={supplierColumns} fields={supplierFields} />;
}
