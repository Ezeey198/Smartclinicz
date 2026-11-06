import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../auth";
import { Empty, Spinner } from "../../components/ui";
import AboutEditor from "./AboutEditor";
import PlaceCard from "./PlaceCard";

// "Clinics" opens here, in the open space of the landing page.
export default function Directory() {
  const { user } = useAuth();
  const [about, setAbout] = useState(null);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(false);
  useEffect(() => { api.get("/public/about").then((r) => setAbout(r.data)); api.get("/public/clinics").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  if (!about || !rows) return <Spinner />;
  const shown = rows.filter((c) => (tab === "all" || c.type === tab) && `${c.name} ${c.city} ${c.country} ${c.tagline} ${c.services.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="pub-wrap pub-section">
      <div className="pub-row"><h1>Clinics and pharmacies</h1>{user?.is_superadmin && <button className="btn ghost" onClick={() => setEdit(true)}><Pencil size={15} />Edit this page's text</button>}</div>
      <p className="pub-lead">{about.clinics_intro}</p>
      {about.features.length > 0 && <div className="pub-features">{about.features.map((f) => <div key={f.heading}><h3>{f.heading}</h3><p>{f.text}</p></div>)}</div>}
      <div className="toolbar" style={{ marginTop: 28 }}>
        <div className="tabs" style={{ margin: 0, minWidth: 280 }}>{[["all", "All"], ["clinic", "Clinics"], ["pharmacy", "Pharmacies"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        <input className="input search" placeholder="Search by name, town or service" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.length === 0 ? <div className="panel"><Empty text={rows.length ? "Nothing matches your search." : "No clinics or pharmacies are listed yet."} /></div> : <div className="place-grid">{shown.map((c) => <PlaceCard key={c.code} c={c} />)}</div>}
      {edit && <AboutEditor about={about} onClose={() => setEdit(false)} onSaved={(d) => { setAbout(d); setEdit(false); }} />}
    </div>
  );
}
