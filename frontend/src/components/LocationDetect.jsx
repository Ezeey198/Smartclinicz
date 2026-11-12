import { useState } from "react";
import { MapPin } from "lucide-react";
import { Input, Notice } from "./ui";

// Turns what the admin typed into a number, or null when it is empty or not a number.
export const coordOrNull = (v) => (v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const valid = (la, lo) => { const a = coordOrNull(la), b = coordOrNull(lo); return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180; };
const six = (n) => Math.round(n * 1e6) / 1e6;

const ERRORS = {
  1: "Location access was blocked. Allow location for this website in your browser settings, then try again.",
  2: "Your device could not work out its position. Turn on GPS or Wi-Fi and try again, or type the coordinates.",
  3: "Finding your position took too long. Try again, ideally near a window or outdoors.",
};

// "Detect my location" reads the position of the device the admin is using (stand at the clinic when pressing it) and keeps the
// numbers in latitude and longitude. The admin can also type them, see the pin on a map, or clear them.
export default function LocationDetect({ latitude, longitude, onChange }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ok = valid(latitude, longitude);

  const detect = () => {
    setMsg(null);
    if (!navigator.geolocation) return setMsg({ tone: "error", text: "This browser cannot detect your location. Type the coordinates instead." });
    if (window.isSecureContext === false) return setMsg({ tone: "error", text: "Location detection only works on a secure (https) address. Open the website with https, or type the coordinates." });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange(six(pos.coords.latitude), six(pos.coords.longitude));
        const m = Math.round(pos.coords.accuracy || 0);
        setMsg(m > 150
          ? { tone: "error", text: `Location found, but only accurate to about ${m} m. For an exact pin, press Detect again from a phone with GPS on, standing at the clinic.` }
          : { tone: "success", text: `Location found${m ? `, accurate to about ${m} m` : ""}. Save to keep it.` });
      },
      (err) => { setBusy(false); setMsg({ tone: "error", text: ERRORS[err.code] || "Could not detect your location. Type the coordinates instead." }); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <div className="loc-detect">
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn ghost sm" onClick={detect} disabled={busy}><MapPin size={15} />{busy ? "Detecting…" : "Detect my location"}</button>
        {(latitude !== null && latitude !== undefined && latitude !== "") && <button type="button" className="btn ghost sm" onClick={() => { onChange(null, null); setMsg(null); }}>Clear</button>}
        {ok && <a className="btn ghost sm" href={`https://www.google.com/maps/search/?api=1&query=${coordOrNull(latitude)},${coordOrNull(longitude)}`} target="_blank" rel="noreferrer">Open in Google Maps</a>}
      </div>
      <p className="hint" style={{ margin: "6px 0 10px" }}>Press this while you are at the clinic. The position is saved with these details and is used to show the exact pin and directions on the public page.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid2">
        <Input label="Latitude" inputMode="decimal" value={latitude ?? ""} onChange={(e) => onChange(e.target.value, longitude ?? "")} placeholder="e.g. 1.714900" />
        <Input label="Longitude" inputMode="decimal" value={longitude ?? ""} onChange={(e) => onChange(latitude ?? "", e.target.value)} placeholder="e.g. 33.611100" />
      </div>
      {ok && <iframe className="map" title="Detected location" loading="lazy" src={`https://www.google.com/maps?q=${coordOrNull(latitude)},${coordOrNull(longitude)}&output=embed`} />}
    </div>
  );
}
