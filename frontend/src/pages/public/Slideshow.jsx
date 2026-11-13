import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { mediaUrl } from "./media";

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const EVERY = 6000;

// A full-page slideshow of every photo the clinics and pharmacies have uploaded. It fades from one photo to the next on its own,
// and names the clinic the photo belongs to. With no photos it draws nothing and the page keeps its plain background.
export default function Slideshow({ onReady }) {
  const [photos, setPhotos] = useState([]);
  const [at, setAt] = useState({ cur: 0, prev: null });
  useEffect(() => { api.get("/public/photos").then((r) => { setPhotos(shuffle(r.data)); onReady?.(r.data.length > 0); }).catch(() => {}); }, []);
  useEffect(() => {
    if (photos.length < 2) return undefined;
    const t = setInterval(() => setAt((s) => ({ cur: (s.cur + 1) % photos.length, prev: s.cur })), EVERY);
    return () => clearInterval(t);
  }, [photos]);
  useEffect(() => { if (photos.length > 1) new Image().src = mediaUrl(photos[(at.cur + 1) % photos.length].id); }, [photos, at.cur]);   // load the next photo before it is needed
  if (photos.length === 0) return null;
  const cur = photos[at.cur], prev = at.prev !== null ? photos[at.prev] : null;
  return (
    <div className="show" aria-hidden={false}>
      {prev && prev.id !== cur.id && <div key={`p${prev.id}`} className="show-slide prev" style={{ backgroundImage: `url(${mediaUrl(prev.id)})` }} />}
      <div key={`c${cur.id}-${at.cur}`} className="show-slide cur" style={{ backgroundImage: `url(${mediaUrl(cur.id)})` }} role="img" aria-label={`Photo from ${cur.clinic}`} />
      <div className="show-shade" />
      <Link className="show-credit" to={`/clinics/${cur.code}`}>{cur.clinic}</Link>
    </div>
  );
}
