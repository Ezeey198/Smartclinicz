import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errMsg } from "../api";
import { Band, Input, Notice } from "../components/ui";

// One sign-in for everybody: superadmin, clinic and pharmacy admins, and all staff. The account is found by its email.
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const signIn = async (code) => {
    setErr(""); setBusy(true);
    try {
      const u = await login({ email: f.email, password: f.password, clinic_code: code || null });
      nav(u.is_superadmin ? "/super" : "/app");
    } catch (x) {
      const d = x.response?.data?.detail;
      if (d && typeof d === "object" && d.code === "choose_organisation") setChoices(d.choices); else setErr(errMsg(x));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand">ClinicPro</div>
        <h1>One sign-in for clinics and pharmacies.</h1>
        <p>Enter your email and password and you go straight to your own workspace: administration, clinic, or pharmacy counter.</p>
        <div className="band-demo"><Band code="CLB-XXXXXX" cls="B" size="xl" /><Band code="PH-XXXXXX" cls="P" size="xl" /></div>
      </section>
      <section className="auth-form">
        <form onSubmit={(e) => { e.preventDefault(); signIn(); }}>
          <h2>Sign in</h2>
          {err && <Notice tone="error">{err}</Notice>}
          {choices ? (
            <>
              <Notice>This email and password work in more than one place. Where do you want to sign in?</Notice>
              <div className="pick-list">{choices.map((c) => <button type="button" key={c.code} className="btn ghost" disabled={busy} onClick={() => signIn(c.code)}><b>{c.name}</b>&nbsp;<span className="sub">{c.code}</span></button>)}</div>
              <button type="button" className="btn ghost block" onClick={() => setChoices(null)}>Back</button>
            </>
          ) : (
            <>
              <Input label="Email" type="email" value={f.email} onChange={set("email")} required autoComplete="username" />
              <Input label="Password" type="password" value={f.password} onChange={set("password")} required autoComplete="current-password" />
              <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
              <p className="hint">New here? Open the activation link in your email to set your password first.</p>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
