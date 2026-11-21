import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import { Input, Notice, PageHead, Spinner, ugx } from "../../components/ui";

const today = () => new Date().toISOString().slice(0, 10);
const REPORTS = [["sales", "Daily sales"], ["dispensing", "Dispensing"], ["purchases", "Purchases"], ["stock", "Stock levels"], ["low", "Low stock"], ["expiry", "Expiry"], ["movements", "Stock movements"], ["returns", "Returns"],
  ["disposals", "Expired and damaged"], ["payments", "Payments"], ["prescriptions", "Prescriptions"], ["staff", "Pharmacy staff"]];
const CARDS = [["sales_today", "Sales today", true], ["dispensed_today", "Dispensed today"], ["low_stock", "Low stock"], ["expiring_soon", "Expiring soon"], ["expired", "Expired stock"], ["pending_returns", "Returns waiting"], ["open_queries", "Open questions to doctors"], ["open_purchases", "Purchases awaiting delivery"]];

// The overview and every pharmacy record and report. The pharmacist and the clinic admin see exactly the same numbers.
export default function PharmReports() {
  const { user } = useAuth();
  const [kind, setKind] = useState("sales");
  const [range, setRange] = useState({ start: today(), end: today() });
  const [rep, setRep] = useState(null);
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/pharm/overview").then((r) => setOv(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(() => { setRep(null); api.get(`/pharm/report/${kind}`, { params: range }).then((r) => setRep(r.data)).catch((e) => setErr(errMsg(e))); }, [kind, range.start, range.end]);
  const cell = (c, v) => (c.kind === "money" ? ugx(v) : c.kind === "num" ? Number(v || 0).toLocaleString() : v === "" || v == null ? "-" : String(v).replace(/_/g, " "));
  const noRange = ["stock", "low", "expiry", "staff"].includes(kind);
  return (
    <>
      <PageHead title="Pharmacy reports and records" sub="Daily sales, dispensing, stock, expiry and purchase reports, and every pharmacy record. Use the dates to look at any day or period.">
        <button className="btn ghost" onClick={() => window.print()}><Printer size={16} />Print</button>
      </PageHead>
      {err && <Notice tone="error">{err}</Notice>}
      {ov && <div className="pharm-cards no-print">{CARDS.map(([k, l, money]) => <div key={k} className={`pharm-card ${["low_stock", "expired", "pending_returns", "open_queries"].includes(k) && ov[k] > 0 ? "warn" : ""}`}><span>{l}</span><b>{money ? ugx(ov[k]) : ov[k]}</b></div>)}</div>}
      <div className="tabs no-print" style={{ margin: "14px 0 12px", flexWrap: "wrap" }}>{REPORTS.map(([k, l]) => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>)}</div>
      {!noRange && <div className="row no-print" style={{ gap: 10, marginBottom: 12 }}><Input label="From" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /><Input label="To" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></div>}
      <div className="panel print-area">
        {!rep ? <Spinner /> : (
          <>
            <div className="pad" style={{ paddingBottom: 0 }}><h3 style={{ margin: 0 }}>{user.clinic?.name} · {rep.title}</h3><div className="sub">{noRange ? `As at ${today()}` : rep.start === rep.end ? rep.start : `${rep.start} to ${rep.end}`} · {rep.rows.length} record{rep.rows.length === 1 ? "" : "s"}{Object.entries(rep.totals).map(([k, v]) => <b key={k}> · Total {ugx(v)}</b>)}</div></div>
            {rep.rows.length === 0 ? <p className="sub pad">Nothing to show for this report.</p> : (
              <div className="scroll"><table className="table"><thead><tr>{rep.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>{rep.rows.map((r, i) => <tr key={i}>{rep.columns.map((c) => <td key={c.key}>{cell(c, r[c.key])}</td>)}</tr>)}</tbody></table></div>)}
          </>)}
      </div>
    </>
  );
}
