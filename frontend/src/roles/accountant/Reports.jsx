import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Spinner, money } from "../../components/ui";

export default function Reports() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/billing/summary").then((r) => setS(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!s) return <Spinner />;
  const max = Math.max(1, ...s.months.map((m) => Math.max(m.billed, m.collected, m.expenses)));
  const cells = [["Billed", money(s.billed)], ["Collected", money(s.collected)], ["Still owed", money(s.outstanding)], ["Expenses", money(s.expenses)], ["Net (collected minus expenses)", money(s.net)]];
  return (
    <>
      <PageHead title="Financial reports" sub="Income and spending, month by month." />
      <div className="strip">{cells.map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      <h3 className="section">By month</h3>
      <div className="panel">
        {s.months.length === 0 ? <Empty text="No billing or expenses yet." /> : (
          <table className="table"><thead><tr><th>Month</th><th>Billed</th><th>Collected</th><th>Expenses</th><th style={{ width: "34%" }}>Collected vs expenses</th></tr></thead>
            <tbody>{s.months.map((m) => (
              <tr key={m.month}><td><b>{m.month}</b></td><td>{money(m.billed)}</td><td>{money(m.collected)}</td><td>{money(m.expenses)}</td>
                <td><div className="bars"><i className="in" style={{ width: `${(m.collected / max) * 100}%` }} /><i className="out" style={{ width: `${(m.expenses / max) * 100}%` }} /></div></td></tr>))}</tbody></table>
        )}
      </div>
    </>
  );
}
