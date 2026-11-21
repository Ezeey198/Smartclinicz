import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Pill } from "../../components/ui";
import { initials, kindLabel, mediaUrl } from "./media";

export default function PlaceCard({ c }) {
  return (
    <Link to={`/clinics/${c.code}`} className="place-card">
      <div className={`place-cover ${c.type}`}>{c.cover_id ? <img src={mediaUrl(c.cover_id)} alt={c.name} loading="lazy" /> : <span>{initials(c.name)}</span>}</div>
      <div className="place-body">
        <Pill tone={c.type === "pharmacy" ? "green" : "blue"}>{kindLabel(c)}</Pill>
        <h3>{c.name}</h3>
        {c.tagline && <p>{c.tagline}</p>}
        {(c.city || c.country) && <div className="sub"><MapPin size={13} style={{ verticalAlign: -2 }} /> {[c.city, c.country].filter(Boolean).join(", ")}</div>}
        {c.services.length > 0 && <div className="chips">{c.services.map((s) => <span key={s}>{s}</span>)}</div>}
      </div>
    </Link>
  );
}
