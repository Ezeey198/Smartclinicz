import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { errMsg } from "../../api";
import { Input, Notice } from "../../components/ui";
import { store } from "../../storage";
import portal, { PATIENT_TOKEN } from "./portalApi";
import PatientCard from "./PatientCard";

export default function PatientLogin() {
  const [f, setF] = useState({ clinic_code: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q] = useSearchParams();
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const { data } = await portal.post("/portal/login", f); store.set(PATIENT_TOKEN, data.token); nav("/patient/home"); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <PatientCard>
      <h2>Patient sign in</h2>
      <p>Follow your visit, get a message at every step and save your final document.</p>
      {q.get("ended") && <Notice>Your session has ended. Your page opens again at your next visit to the clinic.</Notice>}
      <form onSubmit={submit}>
        <Input label="Clinic code" required value={f.clinic_code} onChange={(e) => setF({ ...f, clinic_code: e.target.value })} placeholder="CL-7K3MQ2" />
        <Input label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} hint="The email the clinic has for you or your attendant." />
        <Input label="Password" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <Notice tone="error">{err}</Notice>}
        <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="hint"><Link to="/">Back to the website</Link></p>
    </PatientCard>
  );
}
