import { useState } from "react";
import DataPage from "../../components/DataPage";
import ReceiveStockModal from "../../components/ReceiveStockModal";
import { stockColumns, stockFields } from "../../config/schemas";

const isLab = (r) => /lab|reagent|chemical|equipment|consumable/i.test(r.category || "");
const expiring = (r) => r.expiry_date && new Date(r.expiry_date) <= new Date(Date.now() + 30 * 864e5);

// The laboratory's own stock: equipment, reagents and chemicals. Expiry and low-stock alerts reach the technician twice a day (page and SMS).
export default function LabStock() {
  const [item, setItem] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} module="inventory" title="Laboratory stock" single="laboratory item" createLabel="Add item" empty="No laboratory stock recorded yet. Add equipment, reagents and chemicals; choose a Laboratory category."
        sub="Receive and record all laboratory equipment, reagents and chemicals. Use a Laboratory category so the alerts find them." columns={stockColumns} fields={stockFields}
        tabs={[{ key: "lab", label: "Laboratory stock", filter: isLab }, { key: "low", label: "Running low", filter: (r) => isLab(r) && r.reorder_level != null && r.quantity <= r.reorder_level }, { key: "exp", label: "Expiring soon", filter: (r) => isLab(r) && expiring(r) }]}
        rowActions={(r) => [{ label: "Receive stock", tone: "primary", onClick: () => setItem(r) }]} />
      {item && <ReceiveStockModal item={item} onClose={() => setItem(null)} onDone={() => { setItem(null); setK(k + 1); }} />}
    </>
  );
}
