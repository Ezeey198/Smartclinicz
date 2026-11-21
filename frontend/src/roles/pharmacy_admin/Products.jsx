import { useState } from "react";
import DataPage from "../../components/DataPage";
import { AddBatchModal, BatchesModal } from "../../components/pharmacy/StockModals";
import { productColumns, productFields } from "../../config/schemas";

export default function Products() {
  const [add, setAdd] = useState(null);
  const [view, setView] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} module="products" endpoint="/pharmacy/stock" title="Products" single="product" createLabel="Add product" empty="No products yet. Add the first product, then add its stock."
        sub="Your catalogue with prices and stock. Stock is kept in batches with expiry dates, and the oldest batch is sold first." columns={productColumns} fields={productFields}
        rowActions={(r) => [{ label: "Add stock", tone: "primary", onClick: () => setAdd(r) }, { label: "Batches", onClick: () => setView(r) }]} />
      {add && <AddBatchModal product={add} onClose={() => setAdd(null)} onDone={() => { setAdd(null); setK(k + 1); }} />}
      {view && <BatchesModal product={view} onClose={() => setView(null)} onChanged={() => setK(k + 1)} />}
    </>
  );
}
