import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errMsg } from "../../api";
import { Input, Notice, Spinner } from "../../components/ui";
import portal from "./portalApi";
import PatientCard from "./PatientCard";

// The patient (or their attendant) accepts and approves the account from the emailed link and chooses a password.
export default function PatientActivate() {
  const [q] = useSearchParams();
  const token = q.get("token") || "";
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [done, setDone] = useState(null);
  useEffect(() => { portal.get(`/portal/preview/${token}`).then((r) => setInfo(r.data)).catch((e) => setErr(errMsg(e))); }, [token]);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (pw.a !== pw.b) return setErr("The two passwords do not match.");
    try { const { data } = await portal.post("/portal/activate", { token, password: pw.a }); setDone(data); } catch (x) { setErr(errMsg(x)); }
  };
  if (!info && !err) return <Spinner />;
  if (!info) return <PatientCard><Notice tone="error">{err}</Notice><Link className="btn ghost" to="/patient">Go to patient sign in</Link></PatientCard>;
  if (done) return (
    <PatientCard><h2>Your page is ready</h2><p>Sign in to {done.clinic_name} with clinic code <b>{done.clinic_code}</b> and the email <b>{done.email}</b>.</p><Link className="btn primary" to="/patient">Go to sign in</Link></PatientCard>
  );
  return (
    <PatientCard>
      <h2>Accept your patient page</h2>
      <p>{info.full_name}, <b>{info.clinic_name}</b> has opened a page for you. There you follow each step of your visit and save your final document. Choose a password to accept it.</p>
      <form onSubmit={submit}>
        <Input label="Choose a password" type="password" minLength={8} required value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} hint="At least 8 characters." />
        <Input label="Repeat password" type="password" required value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
        {err && <Notice tone="error">{err}</Notice>}
        <button className="btn primary block">Accept and set password</button>
      </form>
    </PatientCard>
  );
}
