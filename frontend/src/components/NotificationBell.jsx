import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import api from "../api";
import { fmtStamp } from "./ui";

// The bell beside the profile picture. It blinks and shows the number of unread notifications; opening it lists them.
export default function NotificationBell({ base }) {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const nav = useNavigate();
  const load = () => api.get("/notifications").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const h = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const readAll = async () => { await api.post("/notifications/read", {}).catch(() => {}); load(); };
  const go = async (n) => {
    if (!n.read) await api.post("/notifications/read", { ids: [n.id] }).catch(() => {});
    setOpen(false); load();
    if (n.link) nav(n.link.startsWith("/app") || n.link.startsWith("/super") ? n.link : `${base}${n.link}`);
  };
  return (
    <div className="bell-wrap" ref={box}>
      <button className={`icon-btn bell ${data.unread > 0 ? "blink" : ""}`} onClick={() => setOpen(!open)} aria-label={`Notifications, ${data.unread} unread`} title="Notifications">
        <Bell size={20} />{data.unread > 0 && <span className="bell-count">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-head"><b>Notifications</b>{data.unread > 0 && <button className="linklike" onClick={readAll}>Mark all read</button>}</div>
          {data.items.length === 0 ? <p className="sub" style={{ padding: 14 }}>Nothing yet. New activity appears here and is also sent to your phone by SMS.</p> : (
            <div className="bell-list">{data.items.slice(0, 8).map((n) => (
              <button key={n.id} className={`bell-item ${n.read ? "" : "unread"}`} onClick={() => go(n)}>
                <b>{n.title}</b>{n.body && <span>{n.body}</span>}<small>{fmtStamp(n.created_at)}</small>
              </button>))}</div>
          )}
          <Link className="bell-all" to={`${base}/notifications`} onClick={() => setOpen(false)}>See all notifications</Link>
        </div>
      )}
    </div>
  );
}
