import { useState } from "react";
import api, { errMsg } from "../api";
import { Input, Modal, Notice } from "./ui";

export default function ReceiveStockModal({ item, onClose, onDone }) {
  const [f, setF] = useState({ quantity: "", cost: "", pay_from_wallet: "yes" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post(`/inventory/${item.id}/receive`, { quantity: Number(f.quantity), cost: Number(f.cost || 0), pay_from_wallet: f.pay_from_wallet === "yes" }); onDone(); }
    catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Receive stock · ${item.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <Input label={`Quantity received (${item.unit || "units"})`} type="number" min="0" step="any" value={f.quantity} onChange={set("quantity")} required />
          <Input label="Total cost (UGX)" type="number" min="0" step="any" value={f.cost} onChange={set("cost")} hint="Leave empty if there is no cost to record." />
          <Input full label="Pay the supplier from the clinic wallet?"><select className="input" value={f.pay_from_wallet} onChange={set("pay_from_wallet")}>
            <option value="yes">Yes, take it from the wallet</option><option value="no">No, paid another way</option></select></Input>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Receive stock</button></div>
      </form>
    </Modal>
  );
}
