import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Pill, Spinner, ugx } from "../../components/ui";

export default function Expiry() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/pharmacy/expiry").then((r) => setD(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);
  const writeOff = async (b) => {
    if (!window.confirm(`Write off ${b.quantity} of ${b.product_name} (batch ${b.batch_no || "-"})? It leaves the stock.`)) return;
    try { await api.post(`/pharmacy/batches/${b.id}/adjust`, { quantity: 0, reason: "Written off: expired" }); setMsg({ tone: "success", text: "Written off." }); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  if (!d) return <Spinner />;
  const table = (rows, expired) => (
    <div className="panel">{rows.length === 0 ? <Empty text={expired ? "Nothing has expired. Good." : "Nothing expires in the next 90 days."} /> : (
      <div className="scroll"><table className="table"><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Value at cost</th><th /></tr></thead>
        <tbody>{rows.map((b) => (
          <tr key={b.id}><td><b>{b.product_name}</b></td><td>{b.batch_no || "-"}</td><td>{b.expiry_date} <Pill tone={expired ? "coral" : "amber"}>{expired ? `${Math.abs(b.days_left)} days ago` : `in ${b.days_left} days`}</Pill></td>
            <td>{b.quantity}</td><td>{ugx(b.value)}</td><td className="row-actions">{expired && <button className="btn danger sm" onClick={() => writeOff(b)}>Write off</button>}</td></tr>))}</tbody></table></div>)}</div>
  );
  return (
    <>
      <PageHead title="Expiry" sub="Expired stock cannot be sold. Write it off once it is removed from the shelves." />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <h3 className="section" style={{ marginTop: 0 }}>Expired ({d.expired.length})</h3>{table(d.expired, true)}
      <h3 className="section">Expiring within 90 days ({d.soon.length})</h3>{table(d.soon, false)}
    </>
  );
}
