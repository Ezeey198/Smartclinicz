// The open page of one clinic or pharmacy: photos, services, locations and videos. Everyone can look; only its own admin edits.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Globe, Mail, MapPin, Pencil, Phone } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../auth";
import { Empty, Modal, Pill, Spinner } from "../../components/ui";
import { initials, kindLabel, mapEmbed, mapLink, mediaUrl } from "./media";

export default function ClinicPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState(null);
  useEffect(() => { setD(null); setMissing(false); api.get(`/public/clinics/${code}`).then((r) => setD(r.data)).catch(() => setMissing(true)); }, [code]);
  if (missing) return <div className="pub-wrap pub-section"><div className="panel"><Empty text="This page does not exist or is not public."><Link className="btn ghost" to="/clinics">See all clinics and pharmacies</Link></Empty></div></div>;
  if (!d) return <Spinner />;
  const mine = user?.role === "admin" && user.clinic?.code === d.code;
  const cover = d.photos[0];
  return (
    <>
      <section className={`place-hero ${d.type}`} style={cover ? { backgroundImage: `linear-gradient(rgba(18,38,58,.55), rgba(18,38,58,.75)), url(${mediaUrl(cover.id)})` } : undefined}>
        <div className="pub-wrap">
          <Link to="/clinics" className="back">← All clinics and pharmacies</Link>
          <Pill tone={d.type === "pharmacy" ? "green" : "blue"}>{kindLabel(d)}</Pill>
          <h1>{d.name}</h1>
          {d.tagline && <p>{d.tagline}</p>}
          {mine && <Link className="btn ghost light" to="/app/public"><Pencil size={15} />Edit this page</Link>}
        </div>
      </section>
      <div className="pub-wrap pub-section place-layout">
        <div>
          {d.about && <section><h2>About</h2><p className="pre">{d.about}</p></section>}
          <section>
            <h2>Services</h2>
            {d.services.length === 0 ? <p className="sub">No services listed yet.</p> : (
              <div className="svc-grid">{d.services.map((s, i) => <div key={i} className="svc"><b>{s.name}</b>{s.description && <p>{s.description}</p>}{s.price && <span className="price">{s.price}</span>}</div>)}</div>)}
          </section>
          {d.photos.length > 0 && (
            <section><h2>Photos</h2>
              <div className="gallery">{d.photos.map((p) => <button key={p.id} onClick={() => setZoom(p)} title={p.caption || "Open photo"}><img src={mediaUrl(p.id)} alt={p.caption || d.name} loading="lazy" /></button>)}</div></section>
          )}
          {d.videos.length > 0 && (
            <section><h2>Videos</h2>
              <div className="video-grid">{d.videos.map((v) => (
                <figure key={v.id}>
                  <div className="video-frame">
                    {v.source === "file" || v.source === "direct"
                      ? <video controls preload="metadata" src={v.source === "file" ? mediaUrl(v.id) : v.url} />
                      : <iframe src={v.url} title={v.title || "Video"} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />}
                  </div>{v.title && <figcaption>{v.title}</figcaption>}
                </figure>))}</div></section>
          )}
        </div>
        <aside>
          <section><h2>Locations</h2>
            {d.locations.map((l, i) => (
              <div key={i} className="loc">
                <b>{l.label || (i === 0 ? "Main location" : `Location ${i + 1}`)}</b>
                <p><MapPin size={14} /> {[l.address, l.city].filter(Boolean).join(", ")}</p>
                {l.hours && <p><Clock size={14} /> {l.hours}</p>}
                {l.phone && <p><Phone size={14} /> {l.phone}</p>}
                {l.address && <><iframe className="map" title={`Map of ${l.address}`} src={mapEmbed(l)} loading="lazy" /><a className="btn ghost sm" href={mapLink(l)} target="_blank" rel="noreferrer">Get directions</a></>}
              </div>))}
          </section>
          {(d.contact || d.hours) && (
            <section><h2>Contact</h2>
              {d.hours && <p><Clock size={14} /> {d.hours}</p>}
              {d.contact?.phone && <p><Phone size={14} /> <a href={`tel:${d.contact.phone}`}>{d.contact.phone}</a></p>}
              {d.contact?.email && <p><Mail size={14} /> <a href={`mailto:${d.contact.email}`}>{d.contact.email}</a></p>}
              {d.contact?.website && <p><Globe size={14} /> <a href={/^https?:/.test(d.contact.website) ? d.contact.website : `https://${d.contact.website}`} target="_blank" rel="noreferrer">{d.contact.website}</a></p>}
            </section>
          )}
        </aside>
      </div>
      {zoom && <Modal title={zoom.caption || d.name} onClose={() => setZoom(null)} wide><img className="zoom" src={mediaUrl(zoom.id)} alt={zoom.caption || d.name} /></Modal>}
    </>
  );
}
