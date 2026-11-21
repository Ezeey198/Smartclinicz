import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import api from "../../api";
import { mediaUrl } from "./media";

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const PHOTO_EVERY = 5000, VIDEO_MAX = 15000, TILES = 6;

// The six spots share one pool of everything the clinics uploaded. Each spot, whenever it moves on, takes from the whole pool:
// never something already on screen, preferably from a clinic no other spot is showing, the opposite kind to what it shows now (photo, then
// video, then photo...), and, among those, whatever was shown longest ago, so everything gets its turn in a random order.
export function makeBus(photos, videos) {
  const pool = [...photos, ...videos];
  const last = new Map(shuffle(pool).map((x, i) => [x.id, i]));          // a random starting order
  const shown = new Map(), bad = new Set();
  let tick = pool.length;
  const choose = (tile, current, want) => {
    const live = pool.filter((x) => !bad.has(x.id));
    if (!live.length) return null;
    const onScreen = new Set([...shown.values()].map((x) => x.id));
    const elsewhere = new Set([...shown.entries()].filter(([t]) => t !== tile).map(([, x]) => x.code));
    const wantKind = want || (current && current.kind === "photo" ? "video" : "photo");
    const score = (x) => (onScreen.has(x.id) ? 1e7 : 0) + (elsewhere.has(x.code) ? 1e6 : 0) + (current && x.code === current.code ? 5e5 : 0) + (x.kind === wantKind ? 0 : 3e4) + (last.get(x.id) ?? 0) + Math.random();
    return live.reduce((b, x) => (score(x) < score(b) ? x : b), live[0]);
  };
  // Is this item still a good next choice for this spot (not on screen, not from a clinic another spot shows, not broken)?
  const fits = (tile, item) => !bad.has(item.id) && ![...shown.entries()].some(([t, x]) => x.id === item.id || (t !== tile && x.code === item.code));
  const show = (tile, item) => { shown.set(tile, item); last.set(item.id, ++tick); };
  return { choose, fits, show, release: (tile) => shown.delete(tile), markBad: (id) => bad.add(id), size: pool.length };
}

// A video's address, set to play silently on its own. YouTube and Vimeo get their autoplay options; files and direct links play in a <video>.
const embed = (v) => (v.source === "youtube" ? `${v.url}?autoplay=1&mute=1&controls=0&loop=1&playsinline=1&rel=0&modestbranding=1&playlist=${v.url.split("/").pop()}`
  : v.source === "vimeo" ? `${v.url}?autoplay=1&muted=1&background=1&loop=1` : v.source === "file" ? mediaUrl(v.id) : v.url);
const isEmbed = (v) => v.source === "youtube" || v.source === "vimeo";

function Layer({ item, cls, onEnded, single, onBad }) {
  if (item.kind === "photo") return <div className={`tile-slide ${cls}`}><img src={mediaUrl(item.id)} alt={item.caption || `Photo from ${item.clinic}`} onError={() => onBad(item)} /></div>;
  return (
    <div className={`tile-slide ${cls}`}>
      {isEmbed(item) ? <iframe src={embed(item)} title={item.title || `Video from ${item.clinic}`} allow="autoplay; encrypted-media; picture-in-picture" tabIndex={-1} />
        : <video src={embed(item)} muted autoPlay playsInline loop={single} preload="auto" disablePictureInPicture onEnded={onEnded} onError={() => onBad(item)} />}
    </div>
  );
}

// One spot of the grid. It slides, on its own timing, to the next photo or video the shared pool gives it, and opens that clinic's page when pressed.
function SlidingTile({ id, bus, start, startAfter }) {
  const [s, setS] = useState({ cur: start, prev: null });
  const up = useRef(null);                                              // what this spot will show next, chosen early so a photo can be loaded first
  const next = () => setS((x) => {
    const it = up.current && bus.fits(id, up.current) ? up.current : bus.choose(id, x.cur);       // the one picked early, unless things changed meanwhile
    if (!it || it.id === x.cur.id) return x;
    bus.show(id, it);
    return { cur: it, prev: x.cur };
  });
  const dead = (item) => { bus.markBad(item.id); if (item.id === s.cur.id) next(); else up.current = null; };         // an item that will not load (for example just deleted) is dropped
  useEffect(() => {
    up.current = bus.choose(id, s.cur);
    if (up.current && up.current.kind === "photo") { const im = new Image(); const it = up.current; im.onerror = () => dead(it); im.src = mediaUrl(it.id); }
    if (bus.size < 2) return undefined;
    const every = s.cur.kind === "photo" ? PHOTO_EVERY + startAfter * 0.4 : VIDEO_MAX;                  // a photo stays about 5 seconds; a video moves on when it ends, or after 15
    const t = setTimeout(next, s.prev === null ? startAfter + every : every);
    return () => clearTimeout(t);
  }, [s.cur.id]);
  useEffect(() => { if (s.prev === null) return undefined; const t = setTimeout(() => setS((x) => ({ ...x, prev: null })), 900); return () => clearTimeout(t); }, [s.prev]);
  useEffect(() => () => bus.release(id), []);
  const { cur, prev } = s;
  return (
    <div className="tile">
      {prev && <Layer key={`p${prev.id}`} item={prev} cls="out" onBad={dead} />}
      <Layer key={`c${cur.id}`} item={cur} cls={prev ? "in" : ""} onEnded={next} single={bus.size < 2} onBad={dead} />
      <div className="tile-shade" />
      <Link className="tile-link" to={`/clinics/${cur.code}`} aria-label={`Open ${cur.clinic}`}><span className="tile-name">{cur.clinic}</span></Link>
    </div>
  );
}

// The landing page grid: six spots, and every one slides through a random mix of the photos and videos that different clinics uploaded.
export default function Tiles() {
  const [photos, setPhotos] = useState(null);
  const [videos, setVideos] = useState(null);
  // Loads what the clinics' admins uploaded, and checks again every minute so new uploads appear (and deleted ones go) while the page stays open.
  // The tiles are only rearranged when the set of photos or videos really changed.
  useEffect(() => {
    const same = (a, b) => a && a.length === b.length && a.every((x, i) => x.id === b[i].id);
    const load = () => {
      api.get("/public/photos").then((r) => setPhotos((old) => (same(old, r.data) ? old : r.data))).catch(() => setPhotos((old) => old || []));
      api.get("/public/videos").then((r) => setVideos((old) => (same(old, r.data) ? old : r.data))).catch(() => setVideos((old) => old || []));
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);
  const ready = photos !== null && videos !== null;
  // The pool, and what each spot shows first: different items, from different clinics, three photos and three videos.
  const setup = useMemo(() => {
    if (!ready) return null;
    const bus = makeBus(photos.map((x) => ({ ...x, kind: "photo" })), videos.map((x) => ({ ...x, kind: "video" })));
    const first = Array.from({ length: TILES }, (_, t) => { const it = bus.choose(t, null, t % 2 === 0 ? "photo" : "video"); if (it) bus.show(t, it); return it; });
    return { bus, first, key: Math.random().toString(36).slice(2) };       // a new key restarts the spots whenever the uploaded set changes
  }, [photos, videos, ready]);
  return (
    <div className="tiles" aria-label="Photos and videos from clinics">
      {Array.from({ length: TILES }, (_, t) => setup && setup.first[t]
        ? <SlidingTile key={`${t}-${setup.key}`} id={t} bus={setup.bus} start={setup.first[t]} startAfter={t * 1500} />
        : <div key={t} className="tile tile-empty"><ImageOff size={28} /><span>Clinic photos and videos will slide here</span></div>)}
    </div>
  );
}
