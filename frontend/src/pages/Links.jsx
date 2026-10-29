import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api";
import { Band, Input, Notice, Spinner } from "../components/ui";

function Card({ children }) {
  return <div className="link-page"><div className="link-card"><div className="brand dark">ClinicPro</div>{children}</div></div>;
}

function usePreview(kind) {
  const [sp] = useSearchParams();
  const token = sp.get("token");
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!token) return setErr("This link is missing its token.");
    api.get(`/auth/preview/${kind}/${token}`).then((r) => setInfo(r.data)).catch((e) => setErr(errMsg(e)));
  }, [kind, token]);
  return { token, info, err };
}

export function ApproveClinic() {
  const { token, info, err } = usePreview("clinic");
  const [done, setDone] = useState(null);
  const [e2, setE2] = useState("");
  const approve = () => api.post("/auth/approve-clinic", { token }).then((r) => setDone(r.data)).catch((e) => setE2(errMsg(e)));
  if (err) return <Card><Notice tone="error">{err}</Notice><Link className="btn ghost" to="/login">Go to sign in</Link></Card>;
  if (!info) return <Spinner />;
  if (done) return (
    <Card><h2>{done.name} is approved</h2><p>Your clinic is now active. Sign in with this code:</p>
      <Band code={done.clinic_code} cls={done.clinic_code[2]} size="xl" />
      <p className="hint">Also activate your own account from the second email we sent you.</p>
      <Link className="btn primary" to="/login">Go to sign in</Link></Card>
  );
  return (
    <Card>
      <h2>Approve your clinic</h2>
      <p>Check these details. Approving switches the clinic on for you and your staff.</p>
      <dl className="facts">
        <dt>Clinic</dt><dd>{info.name}</dd><dt>Code</dt><dd><Band code={info.code} cls={info.clinic_class} /></dd>
        <dt>Class</dt><dd>{info.clinic_class === "A" ? "Class A (full service)" : "Class B (essential)"}</dd>
        <dt>Location</dt><dd>{[info.address, info.city].filter(Boolean).join(", ") || "—"}</dd>
        <dt>Contact</dt><dd>{[info.email, info.phone].filter(Boolean).join(" · ")}</dd>
        {info.registration_number && (<><dt>Registration</dt><dd>{info.registration_number}</dd></>)}
      </dl>
      {e2 && <Notice tone="error">{e2}</Notice>}
      <button className="btn primary block" onClick={approve}>Approve clinic</button>
    </Card>
  );
}

export function Activate() {
  const { token, info, err } = usePreview("account");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [done, setDone] = useState(null);
  const [e2, setE2] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pw.a !== pw.b) return setE2("The two passwords do not match.");
    api.post("/auth/activate", { token, password: pw.a }).then((r) => setDone(r.data)).catch((x) => setE2(errMsg(x)));
  };
  if (err) return <Card><Notice tone="error">{err}</Notice><Link className="btn ghost" to="/login">Go to sign in</Link></Card>;
  if (!info) return <Spinner />;
  if (done) return (
    <Card><h2>{info.reset ? "Password updated" : "Account activated"}</h2><p>Sign in to {done.clinic_name} with this clinic code:</p>
      <Band code={done.clinic_code} cls={done.clinic_code[2]} size="xl" />
      <Link className="btn primary" to="/login">Go to sign in</Link></Card>
  );
  return (
    <Card>
      <h2>{info.reset ? "Set a new password" : "Activate your account"}</h2>
      <p>{info.full_name}, you are joining <b>{info.clinic_name}</b> as <b>{info.role}</b>.</p>
      <form onSubmit={submit}>
        <Input label="Email" value={info.email} readOnly />
        <Input label="Choose a password" type="password" minLength={8} required value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} hint="At least 8 characters." />
        <Input label="Repeat password" type="password" required value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
        {e2 && <Notice tone="error">{e2}</Notice>}
        <button className="btn primary block">{info.reset ? "Save password" : "Activate account"}</button>
      </form>
    </Card>
  );
}
