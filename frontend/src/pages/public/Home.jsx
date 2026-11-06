import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { Spinner } from "../../components/ui";
import PlaceCard from "./PlaceCard";

export default function Home() {
  const [about, setAbout] = useState(null);
  const [places, setPlaces] = useState([]);
  useEffect(() => { api.get("/public/about").then((r) => setAbout(r.data)).catch(() => setAbout(false)); api.get("/public/clinics").then((r) => setPlaces(r.data.slice(0, 3))).catch(() => {}); }, []);
  if (about === null) return <Spinner />;
  const a = about || { headline: "One system for clinics and pharmacies", intro: "", sections: [] };
  return (
    <>
      <section className="pub-hero">
        <div className="pub-wrap">
          <h1>{a.headline}</h1>
          <p>{a.intro}</p>
          <div className="row"><Link className="btn primary" to="/clinics">Find a clinic or pharmacy</Link><Link className="btn ghost light" to="/about">About the system</Link></div>
        </div>
      </section>
      {a.sections.length > 0 && (
        <section className="pub-wrap pub-section">
          <div className="pub-features">{a.sections.slice(0, 4).map((s) => <div key={s.heading}><h3>{s.heading}</h3><p>{s.text}</p></div>)}</div>
        </section>
      )}
      {places.length > 0 && (
        <section className="pub-wrap pub-section">
          <div className="pub-row"><h2>Places on ClinicPro</h2><Link to="/clinics">See all</Link></div>
          <div className="place-grid">{places.map((c) => <PlaceCard key={c.code} c={c} />)}</div>
        </section>
      )}
    </>
  );
}
