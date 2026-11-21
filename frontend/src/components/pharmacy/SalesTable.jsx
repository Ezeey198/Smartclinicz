import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { DOCS } from "../../config/documents";
import DocumentModal from "../DocumentModal";
import { Empty, Notice, PageHead, Pill, Spinner, fmtStamp, label, ugx } from "../ui";

// Sales history. The admin sees every sale and can cancel one; a seller sees only their own.
export default function SalesTable({ scope, title, sub, canVoid = false }) {
  const [rows, setRows] = useState(null);
  const [day, setDay] = useState("");
  const [doc, setDoc] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/pharmacy/sales", { params: { scope, day: day || undefined } }).then((r) => setRows(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, [day]);
  const openReceipt = async (s) => { try { setDoc(DOCS.sale_receipt((await api.get(`/pharmacy/sales/${s.id}`)).data)); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } };
  const cancel = async (s) => {
    const reason = window.prompt(`Why is sale ${s.receipt_no} being cancelled? The stock goes back on the shelf and the money comes out of the wallet.`);
    if (!reason || reason.trim().length < 3) return;
    try { await api.post(`/pharmacy/sales/${s.id}/void`, { reason }); setMsg({ tone: "success", text: `${s.receipt_no} was cancelled.` }); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  if (!rows) return <Spinner />;
  const live = rows.filter((r) => r.status === "completed");
  return (
    <>
      <PageHead title={title} sub={sub} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="strip"><div className="strip-item"><b>{live.length}</b><span>Sales</span></div><div className="strip-item"><b>{ugx(live.reduce((s, r) => s + r.total, 0))}</b><span>Total sold</span></div>
        <div className="strip-item"><b>{live.reduce((s, r) => s + r.items, 0)}</b><span>Items sold</span></div></div>
      <div className="toolbar" style={{ marginTop: 16 }}><label className="fld" style={{ margin: 0 }}><span>Day</span><input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        {day && <button className="btn ghost sm" onClick={() => setDay("")}>Show recent sales</button>}</div>
      <div className="panel">
        {rows.length === 0 ? <Empty text="No sales found." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Receipt</th><th>When</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid by</th>{canVoid && <th>Sold by</th>}<th /></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}><td><b>{s.receipt_no}</b>{s.status === "voided" && <> <Pill tone="coral">Cancelled</Pill></>}{s.void_reason && <div className="sub">{s.void_reason}</div>}</td>
                <td className="sub">{fmtStamp(s.created_at)}</td><td>{s.customer_name || <span className="sub">Walk-in</span>}</td><td>{s.items}</td><td><b>{ugx(s.total)}</b></td><td>{label(s.payment_method)}</td>
                {canVoid && <td>{s.sold_by}</td>}
                <td className="row-actions"><button className="btn ghost sm" onClick={() => openReceipt(s)}>Receipt</button>
                  {canVoid && s.status === "completed" && <button className="btn danger sm" onClick={() => cancel(s)}>Cancel sale</button>}</td></tr>))}</tbody></table></div>
        )}
      </div>
      {doc && <DocumentModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  );
}
