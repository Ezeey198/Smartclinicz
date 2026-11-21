import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { Empty, PageHead, Spinner, fmtStamp } from "../../components/ui";

export default function Notifications() {
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  const load = () => api.get("/notifications").then((r) => setRows(r.data.items));
  useEffect(() => { load(); }, []);
  if (!rows) return <Spinner />;
  const open = async (n) => { if (!n.read) { await api.post("/notifications/read", { ids: [n.id] }); load(); } if (n.link) nav(n.link.startsWith("/") ? n.link : `/app/${n.link}`); };
  return (
    <>
      <PageHead title="Notifications" sub="Everything new in the system. Each one is also sent to your phone by SMS.">
        {rows.some((n) => !n.read) && <button className="btn ghost" onClick={async () => { await api.post("/notifications/read", {}); load(); }}>Mark all read</button>}
      </PageHead>
      <div className="panel">
        {rows.length === 0 ? <Empty text="No notifications yet." /> : rows.map((n) => (
          <button key={n.id} className={`bell-item ${n.read ? "" : "unread"}`} onClick={() => open(n)}><b>{n.title}</b>{n.body && <span>{n.body}</span>}<small>{fmtStamp(n.created_at)}</small></button>))}
      </div>
    </>
  );
}
