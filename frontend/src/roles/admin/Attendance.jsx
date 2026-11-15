import { useEffect, useState } from "react";
import api from "../../api";
import { Empty, PageHead, Spinner, fmtStamp } from "../../components/ui";

// Who clocked in at the clinic and when. A clock-in is only accepted within 20 metres of the saved clinic location.
export default function Attendance() {
  const [rows, setRows] = useState(null);
  const [days, setDays] = useState(14);
  useEffect(() => { api.get("/attendance", { params: { days } }).then((r) => setRows(r.data)); }, [days]);
  if (!rows) return <Spinner />;
  const hrs = (a) => (a.clock_out ? `${((Date.parse(a.clock_out) - Date.parse(a.clock_in)) / 3600000).toFixed(1)} h` : "Still in");
  return (
    <>
      <PageHead title="Attendance" sub="Everyone clocks in from the clinic, within 20 metres of the location you saved in Clinic settings.">
        <select className="input" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>
      </PageHead>
      <div className="panel">
        {rows.length === 0 ? <Empty text="No clock-ins in this period." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>Name</th><th>Clocked in</th><th>Clocked out</th><th>Time at work</th><th>Distance</th></tr></thead>
            <tbody>{rows.map((a) => <tr key={a.id}><td><b>{a.user_name}</b></td><td>{fmtStamp(a.clock_in)}</td><td>{a.clock_out ? fmtStamp(a.clock_out) : "-"}</td><td>{hrs(a)}</td><td>{a.distance_m} m</td></tr>)}</tbody></table></div>)}
      </div>
    </>
  );
}
