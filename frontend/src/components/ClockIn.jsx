import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import api, { errMsg } from "../api";

// Attendance. Clocking in sends the phone's position; the server only accepts it within 20 metres of the clinic's saved location.
export default function ClockIn({ full = false }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/attendance/status").then((r) => setSt(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!st) return null;

  const clockIn = () => {
    setMsg(null);
    if (!navigator.geolocation) return setMsg({ tone: "error", text: "This device cannot find its position." });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try { await api.post("/attendance/clock-in", { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }); setMsg({ tone: "success", text: "You are clocked in." }); load(); }
        catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
        finally { setBusy(false); }
      },
      (err) => { setBusy(false); setMsg({ tone: "error", text: err.code === 1 ? "Allow location access to clock in." : "Could not find your position. Turn on GPS and try again." }); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const clockOut = async () => { setBusy(true); try { await api.post("/attendance/clock-out"); setMsg(null); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } finally { setBusy(false); } };
  const since = st.since ? new Date(st.since + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`clock ${full ? "full" : ""}`}>
      {st.clocked_in
        ? <button className="btn ghost sm" onClick={clockOut} disabled={busy}><Clock3 size={15} />In since {since} · Clock out</button>
        : <button className="btn primary sm" onClick={clockIn} disabled={busy || !st.location_set} title={st.location_set ? `You must be within ${st.radius_m} m of the clinic` : "The clinic admin has not saved the clinic location yet"}><Clock3 size={15} />{busy ? "Checking position…" : "Clock in"}</button>}
      {msg && <small className={`clock-msg ${msg.tone}`}>{msg.text}</small>}
    </div>
  );
}
