import DataPage from "../../components/DataPage";
import { priceColumns } from "../../config/schemas";

export default function PriceList() {
  return <DataPage module="prices" title="Price list" single="price" readOnly empty="No prices have been set yet."
    sub="What each service costs at this clinic." columns={priceColumns} />;
}
