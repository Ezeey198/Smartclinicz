import DataPage from "../../components/DataPage";
import api, { errMsg } from "../../api";
import { stockColumns, stockFields } from "../../config/schemas";

export default function Stock() {
  return <DataPage module="inventory" title="Pharmacy stock" single="stock item" createLabel="Add item" empty="No stock recorded yet."
    sub="Medicines and supplies. Items at or below their reorder level are marked Low." columns={stockColumns} fields={stockFields}
    rowActions={(r, { reload, notify }) => [{ label: "Issue stock", onClick: async () => {
      const n = Number(window.prompt(`How many ${r.unit || "units"} of ${r.name} are you issuing?`, "1"));
      if (!n || n <= 0) return;
      if (n > r.quantity) return notify({ tone: "error", text: `Only ${r.quantity} in stock.` });
      try { await api.patch(`/inventory/${r.id}`, { quantity: r.quantity - n }); notify({ tone: "success", text: "Stock updated." }); reload(); }
      catch (e) { notify({ tone: "error", text: errMsg(e) }); }
    } }]} />;
}
