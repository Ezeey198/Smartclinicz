import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import Avatar from "../../components/Avatar";
import { Input, Notice, PageHead, fmtStamp } from "../../components/ui";

// Messages between the people of one clinic: everyone on the left, the conversation on the right, and the AI assistant at the top right.
export default function Chat() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [who, setWho] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef(null);
  const loadPeople = () => api.get("/chat/users").then((r) => setPeople(r.data)).catch((e) => setErr(errMsg(e)));
  const loadThread = (id) => api.get(`/chat/with/${id}`).then((r) => setMsgs(r.data)).catch(() => {});
  useEffect(() => { loadPeople(); const id = setInterval(loadPeople, 15000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!who) return undefined; loadThread(who.id); const id = setInterval(() => loadThread(who.id), 5000); return () => clearInterval(id); }, [who?.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, who?.id]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !who) return;
    try { await api.post(`/chat/with/${who.id}`, { body: text }); setText(""); loadThread(who.id); } catch (x) { setErr(errMsg(x)); }
  };
  const pick = (p) => { setWho(p); setPeople((ps) => ps.map((x) => (x.id === p.id ? { ...x, unread: 0 } : x))); };

  return (
    <>
      <PageHead title="Chat" sub="Message anyone at your clinic." />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="chat">
        <div className="chat-users">
          {people.length === 0 && <p className="sub" style={{ padding: 14 }}>No one else is at your clinic yet.</p>}
          {people.map((p) => (
            <button key={p.id} className={`chat-user ${who?.id === p.id ? "on" : ""}`} onClick={() => pick(p)}>
              <Avatar user={p} size={36} /><span><b>{p.full_name}</b><small>{p.role_label}</small></span>{p.unread > 0 && <span className="badge">{p.unread}</span>}
            </button>))}
        </div>
        <div className="chat-main">
          <div className="chat-top"><b>{who ? who.full_name : "Choose someone to chat with"}</b><Link className="btn ghost sm" to="/app/ai"><Sparkles size={15} />AI assistant</Link></div>
          <div className="chat-body">
            {who && msgs.length === 0 && <p className="sub">No messages yet. Say hello.</p>}
            {msgs.map((m) => <div key={m.id} className={`bubble ${m.sender_id === user.id ? "me" : ""}`}>{m.body}<small>{fmtStamp(m.created_at)}</small></div>)}
            <div ref={end} />
          </div>
          {who && (
            <form className="chat-send" onSubmit={send}>
              <Input label="" full value={text} onChange={(e) => setText(e.target.value)} placeholder="Write or speak a message" />
              <button className="btn primary" disabled={!text.trim()}><Send size={16} />Send</button>
            </form>)}
        </div>
      </div>
    </>
  );
}
