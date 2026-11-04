import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errMsg } from "../api";
import { Band, Input, Notice } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("clinic");
  const [f, setF] = useState({ clinic_code: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const u = await login({ clinic_code: mode === "clinic" ? f.clinic_code : null, email: f.email, password: f.password });
      nav(u.is_superadmin ? "/super" : "/app");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand">ClinicPro</div>
        <h1>Your clinic opens with its code.</h1>
        <p>Every clinic gets its own code. Your clinic admin shares it when your account is created. Keep it handy, like a wristband.</p>
        <div className="band-demo"><Band code="CLA-XXXXXX" cls="A" size="xl" /><Band code="CLB-XXXXXX" cls="B" size="xl" /></div>
      </section>
      <section className="auth-form">
        <form onSubmit={submit}>
          <h2>Sign in</h2>
          <div className="tabs" role="tablist">
            <button type="button" className={mode === "clinic" ? "on" : ""} onClick={() => setMode("clinic")}>Clinic staff</button>
            <button type="button" className={mode === "super" ? "on" : ""} onClick={() => setMode("super")}>Superadmin</button>
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          {mode === "clinic" && <Input label="Clinic code" value={f.clinic_code} onChange={set("clinic_code")} placeholder="CLA-7K3MQ" required autoCapitalize="characters" />}
          <Input label="Email" type="email" value={f.email} onChange={set("email")} required autoComplete="username" />
          <Input label="Password" type="password" value={f.password} onChange={set("password")} required autoComplete="current-password" />
          <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="hint">New here? Open the activation link in your email to set your password first.</p>
        </form>
      </section>
    </div>
  );
}
