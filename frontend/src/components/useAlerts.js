import { useEffect, useRef, useState } from "react";
import api from "../api";

// Polls the clinic admin's unread alerts and raises a toast when new activity arrives.
export default function useAlerts(enabled) {
  const [count, setCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const prev = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const { data } = await api.get("/activity/unread");
        if (stop) return;
        if (prev.current !== null && data.count > prev.current) {
          const fresh = data.latest.slice(0, data.count - prev.current);
          setToasts((t) => [...t, ...fresh].slice(-4));
          fresh.forEach((a) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), 9000));
        }
        prev.current = data.count;
        setCount(data.count);
      } catch { /* try again on the next tick */ }
    };
    tick();
    const id = setInterval(tick, 15000);
    window.addEventListener("alerts-seen", tick);
    return () => { stop = true; clearInterval(id); window.removeEventListener("alerts-seen", tick); };
  }, [enabled]);

  return { count, toasts, dismiss: (id) => setToasts((t) => t.filter((x) => x.id !== id)) };
}
