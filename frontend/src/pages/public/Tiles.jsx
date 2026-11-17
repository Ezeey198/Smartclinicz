import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, VideoOff } from "lucide-react";
import api from "../../api";
import { mediaUrl } from "./media";

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Deals the shuffled items round and round into `n` tiles, so no two tiles show the same photo or video at the same moment (when there are enough).
const deal = (items, n) => { const lists = Array.from({ length: n }, () => []); shuffle(items).forEach((x, i) => lists[i % n].push(x)); return lists.map((l, i) => (l.length ? l : items.length ? [items[i % items.length]] : [])); };
const PHOTO_EVERY = 5000, VIDEO_MAX = 15000;

// A video's address, set to play silently on its own. YouTube and Vimeo get their autoplay options; files and direct links play in a <video>.
const embed = (v) => (v.source === "youtube" ? `${v.url}?autoplay=1&mute=1&controls=0&loop=1&playsinline=1&rel=0&modestbranding=1&playlist=${v.url.split("/").pop()}`
  : v.source === "vimeo" ? `${v.url}?autoplay=1&muted=1&background=1&loop=1` : v.source === "file" ? mediaUrl(v.id) : v.url);
const isEmbed = (v) => v.source === "youtube" || v.source === "vimeo";

function Layer({ item, kind, cls, onEnded, single }) {
  if (kind === "photo") return <div className={`tile-slide ${cls}`} style={{ backgroundImage: `url(${mediaUrl(item.id)})` }} role="img" aria-label={`Photo from ${item.clinic}`} />;
  return (
    <div className={`tile-slide ${cls}`}>
      {isEmbed(item) ? <iframe src={embed(item)} title={item.title || `Video from ${item.clinic}`} allow="autoplay; encrypted-media; picture-in-picture" tabIndex={-1} />
        : <video src={embed(item)} muted autoPlay playsInline loop={single} preload="auto" disablePictureInPicture onEnded={onEnded} />}
    </div>
  );
}

// One tile of the grid. It slides, on its own timing, from one photo (or video) to the next, and opens that clinic's page when pressed.
function SlidingTile({ items, kind, startAfter }) {
  const [s, setS] = useState({ cur: 0, prev: null });
  const timer = useRef(null);
  const n = items.length;
  const next = () => setS((x) => (n > 1 ? { cur: (x.cur + 1) % n, prev: x.cur } : x));
  useEffect(() => {
    if (n < 2) return undefined;
    const every = kind === "photo" ? PHOTO_EVERY + startAfter * 0.4 : VIDEO_MAX;      // a video moves on when it ends, or after 15 seconds
    timer.current = setTimeout(next, s.cur === 0 && s.prev === null ? startAfter + every : every);
    return () => clearTimeout(timer.current);
  }, [s.cur, n]);
  useEffect(() => { if (s.prev === null) return undefined; const t = setTimeout(() => setS((x) => ({ ...x, prev: null })), 900); return () => clearTimeout(t); }, [s.prev]);
  useEffect(() => { if (kind === "photo" && n > 1) new Image().src = mediaUrl(items[(s.cur + 1) % n].id); }, [s.cur, n]);        // the next photo is loaded before it slides in
  if (n === 0) return <div className="tile tile-empty">{kind === "photo" ? <ImageOff size={28} /> : <VideoOff size={28} />}<span>{kind === "photo" ? "Clinic photos will slide here" : "Clinic videos will play here"}</span></div>;
  const cur = items[s.cur], prev = s.prev !== null ? items[s.prev] : null;
  return (
    <div className="tile">
      {prev && prev !== cur && <Layer key={`p${s.prev}-${prev.id}`} item={prev} kind={kind} cls="out" />}
      <Layer key={`c${s.cur}-${cur.id}`} item={cur} kind={kind} cls={prev ? "in" : ""} onEnded={next} single={n === 1} />
      <div className="tile-shade" />
      <Link className="tile-link" to={`/clinics/${cur.code}`} aria-label={`Open ${cur.clinic}`}><span className="tile-name">{cur.clinic}</span></Link>
    </div>
  );
}

// The landing page grid: three tiles of sliding clinic photos above three tiles of sliding clinic videos.
export default function Tiles() {
  const [photos, setPhotos] = useState(null);
  const [videos, setVideos] = useState(null);
  useEffect(() => { api.get("/public/photos").then((r) => setPhotos(r.data)).catch(() => setPhotos([])); api.get("/public/videos").then((r) => setVideos(r.data)).catch(() => setVideos([])); }, []);
  const p = useMemo(() => deal(photos || [], 3), [photos]);
  const v = useMemo(() => deal(videos || [], 3), [videos]);
  return (
    <div className="tiles" aria-label="Photos and videos from clinics">
      {[0, 1, 2].map((i) => <SlidingTile key={`p${i}-${photos ? photos.length : "x"}`} items={p[i]} kind="photo" startAfter={i * 1700} />)}
      {[0, 1, 2].map((i) => <SlidingTile key={`v${i}-${videos ? videos.length : "x"}`} items={v[i]} kind="video" startAfter={i * 2300} />)}
    </div>
  );
}
