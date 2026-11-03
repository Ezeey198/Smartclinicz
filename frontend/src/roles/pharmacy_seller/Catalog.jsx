import DataPage from "../../components/DataPage";
import { productColumns } from "../../config/schemas";

export default function Catalog() {
  return <DataPage module="products" endpoint="/pharmacy/stock" title="Products" single="product" readOnly empty="No products yet." sub="Prices and what is in stock." columns={productColumns} />;
}
