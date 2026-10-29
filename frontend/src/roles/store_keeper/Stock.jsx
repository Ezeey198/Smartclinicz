import { useState } from "react";
import DataPage from "../../components/DataPage";
import ReceiveStockModal from "../../components/ReceiveStockModal";
import { stockColumns, stockFields } from "../../config/schemas";

export default function Stock() {
  const [item, setItem] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} module="inventory" title="Stock" single="stock item" createLabel="Add item" empty="No stock recorded yet. Add the first item."
        sub="Everything the clinic keeps in store. Receiving stock can pay the supplier straight from the clinic wallet." columns={stockColumns} fields={stockFields}
        tabs={[{ key: "all", label: "All items", filter: () => true }, { key: "low", label: "Low stock", filter: (r) => r.reorder_level != null && r.quantity <= r.reorder_level }]}
        rowActions={(r) => [{ label: "Receive stock", tone: "primary", onClick: () => setItem(r) }]} />
      {item && <ReceiveStockModal item={item} onClose={() => setItem(null)} onDone={() => { setItem(null); setK(k + 1); }} />}
    </>
  );
}
