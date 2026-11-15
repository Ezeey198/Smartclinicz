import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import api, { errMsg } from "../../api";
import { Input, Notice, PageHead } from "../../components/ui";

// An AI assistant for extra consultation. It helps staff think; it never replaces their own clinical judgement.
export default function AiAssistant() {
  const [turns, setTurns] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);
  const ask = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const next = [...turns, { role: "user", content: text }];
    setTurns(next); setText(""); setErr(""); setBusy(true);
    try { const { data } = await api.post("/chat/ai", { messages: next }); setTurns([...next, { role: "assistant", content: data.reply }]); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="AI assistant" sub="Ask for a second opinion, drug information or help with notes. Use your own clinical judgement for every decision."><Link className="btn ghost" to="/app/chat">Back to chat</Link></PageHead>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="chat" style={{ gridTemplateColumns: "1fr" }}>
        <div className="chat-main">
          <div className="chat-body">
            {turns.length === 0 && <p className="sub">Type or speak your question below. Nothing you ask here is saved.</p>}
            {turns.map((t, i) => <div key={i} className={`bubble ${t.role === "user" ? "me" : ""}`}>{t.content}</div>)}
            {busy && <div className="bubble"><span className="sub">Thinking…</span></div>}
            <div ref={end} />
          </div>
          <form className="chat-send" onSubmit={ask}>
            <Input label="" full value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the AI assistant" />
            <button className="btn primary" disabled={busy || !text.trim()}><Send size={16} />Ask</button>
          </form>
        </div>
      </div>
    </>
  );
}
