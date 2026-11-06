import { useEffect, useState } from "react";
import api, { API_BASE } from "../api";

// Tells people plainly when the backend cannot be reached, instead of a page that just fails.
export default function ServerBanner() {
  const [down, setDown] = useState(false);
  const [other, setOther] = useState(null);   // the server's version, when it differs from this website's
  useEffect(() => {
    let stop = false;
    const check = () => api.get("/health", { timeout: 15000 }).then((r) => { if (stop) return; setDown(false); setOther(r.data.version !== APP_VERSION ? r.data.version || "older" : null); }).catch(() => !stop && setDown(true));
    check();
    const id = setInterval(check, 30000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  if (other) return <div className="server-banner warn">This website is version {APP_VERSION} but the server is version {other}. They must be updated together: redeploy whichever one is older, then refresh.</div>;
  if (!down) return null;
  return <div className="server-banner">Cannot reach the server ({API_BASE}). Check your internet connection. If the server was idle it may be waking up, so wait a minute and refresh.</div>;
}
