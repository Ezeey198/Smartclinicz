import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Empty, Input, Notice, PageHead, Pill, Spinner, fmtDateTime } from "../../components/ui";

const linkify = (t) => t.split(/(https?:\/\/\S+)/g).map((p, i) => (/^https?:/.test(p) ? <a key={i} href={p}>{p}</a> : p));

export default function Outbox() {
  const [rows, setRows] = useState(null);
  const [st, setSt] = useState(null);
  const [to, setTo] = useState("");
  const [res, setRes] = useState(null);
  const load = () => api.get("/superadmin/outbox").then((r) => setRows(r.data));
  useEffect(() => { load(); api.get("/superadmin/email-status").then((r) => setSt(r.data)); }, []);
  const test = async (e) => {
    e.preventDefault(); setRes(null);
    try { setRes((await api.post("/superadmin/email-test", { to })).data); load(); } catch (x) { setRes({ error: errMsg(x) }); }
  };
  if (!rows || !st) return <Spinner />;
  return (
    <>
      <PageHead title="Email outbox" sub="Every approval and activation email, with its links. Open a link here if an email did not arrive." />
      {st.configured
        ? <Notice>Sending through {st.host}:{st.port} ({st.security}) as {st.from}. Links in emails open {st.frontend_url}.</Notice>
        : <Notice tone="error">Email sending is off: SMTP_HOST is empty in backend/.env, so emails are only stored here. Fill in the SMTP settings and restart the backend to send real email. Links in emails open {st.frontend_url}.</Notice>}
      <form className="panel pad testmail" onSubmit={test}>
        <Input label="Send a test email to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        <button className="btn ghost">Send test</button>
        {res && (res.error ? <Notice tone="error">{res.error}</Notice>
          : res.sent ? <Notice tone="success">Test email sent to {res.to}.</Notice>
          : <Notice tone="error">Not sent: {res.error || "SMTP is not set up."}</Notice>)}
      </form>
      <div className="panel" style={{ marginTop: 16 }}>
        {rows.length === 0 ? <Empty text="No emails yet. They appear here when you register a clinic." /> : rows.map((m) => (
          <details key={m.id} className="mail">
            <summary><b>{m.subject}</b><span className="sub">to {m.to} · {fmtDateTime(m.created_at)}</span><Pill tone={m.sent ? "green" : m.error ? "coral" : "gray"}>{m.sent ? "Sent" : m.error ? "Failed" : "Stored"}</Pill></summary>
            <pre>{linkify(m.body)}</pre>{m.error && <Notice tone="error">{m.error}</Notice>}
          </details>
        ))}
      </div>
    </>
  );
}
