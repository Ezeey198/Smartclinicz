import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Notice, PageHead, Pill, Spinner, fmtStamp, label } from "../../components/ui";

const toneOf = { created: "green", updated: "blue", deleted: "coral", paid: "green", topup: "blue", received: "green", deactivated: "amber", activated: "green" };

function Details({ d }) {
  if (!d) return null;
  return (
    <dl className="facts compact">
      {Object.entries(d).map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{label(k)}</dt>
          <dd>{v && typeof v === "object" && "to" in v ? <>{String(v.from ?? "empty")} <span className="sub">changed to</span> <b>{String(v.to ?? "empty")}</b></> : String(v ?? "-")}</dd>
        </div>))}
    </dl>
  );
}

export default function Activity() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get("/activity").then(async (r) => {
      setData(r.data);
      await api.post("/activity/seen");          // opening the page clears the alert count
      window.dispatchEvent(new Event("alerts-seen"));
    }).catch((e) => setErr(errMsg(e)));
  }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!data) return <Spinner />;
  const mods = [...new Set(data.items.map((a) => a.module))];
  const shown = data.items.filter((a) => (mod === "all" || a.module === mod) && `${a.user_name} ${a.summary}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Alerts and activity" sub="Everything done in your clinic: who did it, when, and the details. New items are highlighted." />
      <div className="toolbar">
        <input className="input search" placeholder="Search by person or action" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={mod} onChange={(e) => setMod(e.target.value)}><option value="all">All areas</option>{mods.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
      </div>
      <div className="panel">
        {shown.length === 0 ? <Empty text="No activity yet." /> : shown.map((a) => (
          <details key={a.id} className={`mail ${a.id > data.last_seen ? "fresh" : ""}`}>
            <summary>
              <b>{a.user_name}</b><span className="sub">{label(a.role)}</span>
              <span style={{ flex: 1 }}>{a.summary}</span>
              <Pill tone={toneOf[a.action] || "gray"}>{label(a.action)}</Pill><span className="sub">{fmtStamp(a.created_at)}</span>
            </summary>
            <Details d={a.details} />
          </details>))}
      </div>
    </>
  );
}
