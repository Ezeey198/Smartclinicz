import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Spinner, label, ugx } from "../../components/ui";

export default function Reports() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { setD(null); api.get("/pharmacy/reports/summary", { params: { days } }).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, [days]);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <Spinner />;
  const max = Math.max(1, ...d.by_day.map((x) => x.revenue));
  const cells = [["Sold", ugx(d.revenue)], ["Cost of goods", ugx(d.cost_of_goods)], ["Gross profit", ugx(d.gross_profit)], ["Sales", d.sales], ["Average sale", ugx(d.average_sale)], ["Items sold", d.items_sold]];
  return (
    <>
      <PageHead title="Reports" sub="Sales, profit and what sells best.">
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></PageHead>
      <div className="strip">{cells.map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      <h3 className="section">Sales by day</h3>
      <div className="panel">{d.by_day.length === 0 ? <Empty text="No sales in this period." /> : (
        <table className="table"><thead><tr><th>Day</th><th>Sales</th><th>Sold</th><th style={{ width: "40%" }} /></tr></thead>
          <tbody>{[...d.by_day].reverse().map((x) => <tr key={x.day}><td><b>{x.day}</b></td><td>{x.count}</td><td>{ugx(x.revenue)}</td><td><div className="bars"><i className="in" style={{ width: `${(x.revenue / max) * 100}%` }} /></div></td></tr>)}</tbody></table>)}</div>
      <div className="grid2" style={{ marginTop: 24, alignItems: "start" }}>
        <div><h3 className="section" style={{ marginTop: 0 }}>Top products</h3><div className="panel">{d.top_products.length === 0 ? <Empty text="Nothing sold yet." /> : (
          <table className="table"><thead><tr><th>Product</th><th>Qty</th><th>Sold</th></tr></thead><tbody>{d.top_products.map((p) => <tr key={p.name}><td><b>{p.name}</b></td><td>{p.quantity}</td><td>{ugx(p.revenue)}</td></tr>)}</tbody></table>)}</div></div>
        <div><h3 className="section" style={{ marginTop: 0 }}>By seller</h3><div className="panel">{d.by_seller.length === 0 ? <Empty text="No sales yet." /> : (
          <table className="table"><thead><tr><th>Seller</th><th>Sales</th><th>Sold</th></tr></thead><tbody>{d.by_seller.map((s) => <tr key={s.name}><td><b>{s.name}</b></td><td>{s.count}</td><td>{ugx(s.revenue)}</td></tr>)}</tbody></table>)}</div>
          <h3 className="section">By payment method</h3><div className="panel">{d.by_method.length === 0 ? <Empty text="No sales yet." /> : (
            <table className="table"><tbody>{d.by_method.map((m) => <tr key={m.method}><td><b>{label(m.method)}</b></td><td>{ugx(m.total)}</td></tr>)}</tbody></table>)}</div></div>
      </div>
    </>
  );
}
