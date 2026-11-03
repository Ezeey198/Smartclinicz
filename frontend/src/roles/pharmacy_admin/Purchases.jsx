import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api, { errMsg } from "../../api";
import ReceivePurchaseModal from "../../components/pharmacy/ReceivePurchaseModal";
import { Empty, Modal, Notice, PageHead, Pill, Spinner, fmtStamp, ugx } from "../../components/ui";

export default function Purchases() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/pharmacy/purchases").then((r) => setRows(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);
  const show = async (p) => setDetail((await api.get(`/pharmacy/purchases/${p.id}`)).data);
  if (!rows) return <Spinner />;
  return (
    <>
      <PageHead title="Purchases" sub="Stock received from suppliers. Each purchase adds batches to stock and can be paid from the pharmacy wallet.">
        <button className="btn primary" onClick={() => setOpen(true)}><Plus size={16} />Receive stock</button></PageHead>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="panel">
        {rows.length === 0 ? <Empty text="No purchases yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Purchase</th><th>When</th><th>Supplier</th><th>Invoice</th><th>Cost</th><th>Received by</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="click" onClick={() => show(p)}><td><b>{p.ref_no}</b></td><td className="sub">{fmtStamp(p.created_at)}</td><td>{p.supplier_name || "-"}</td><td>{p.supplier_invoice || "-"}</td>
                <td><b>{ugx(p.total_cost)}</b> {p.paid_from_wallet && <Pill tone="blue">Wallet</Pill>}</td><td>{p.received_by}</td></tr>))}</tbody></table></div>
        )}
      </div>
      {open && <ReceivePurchaseModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); setMsg({ tone: "success", text: "Stock received and added to the shelves." }); load(); }} />}
      {detail && (
        <Modal title={`Purchase ${detail.ref_no}`} onClose={() => setDetail(null)} wide>
          <p className="sub">{detail.supplier_name || "No supplier"} · {fmtStamp(detail.created_at)} · received by {detail.received_by}</p>
          <table className="table"><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Unit cost</th><th>Amount</th></tr></thead>
            <tbody>{detail.lines.map((l) => <tr key={l.id}><td><b>{l.product_name}</b></td><td>{l.batch_no || "-"}</td><td>{l.expiry_date || "-"}</td><td>{l.quantity}</td><td>{ugx(l.unit_cost)}</td><td>{ugx(l.quantity * l.unit_cost)}</td></tr>)}</tbody></table>
          <p style={{ textAlign: "right" }}><b>Total {ugx(detail.total_cost)}</b></p>
        </Modal>
      )}
    </>
  );
}
