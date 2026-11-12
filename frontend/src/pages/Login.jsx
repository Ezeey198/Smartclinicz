import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { errMsg } from "../api";
import { Band, Input, Notice } from "../components/ui";

// /login is for clinic and pharmacy staff only. The superadmin page is the same form at /superadmin, which is not linked anywhere.
export default function Login({ superadmin = false }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const mode = superadmin ? "super" : "clinic";
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
      <section className="auth-form">
        <form onSubmit={submit}>
          <h2>{superadmin ? "Superadmin sign in" : "Sign in"}</h2>
          {err && <Notice tone="error">{err}</Notice>}
          {mode === "clinic" && <Input label="code" value={f.clinic_code} onChange={set("clinic_code")} placeholder="XX-7K3MQ2" required autoCapitalize="characters" />}
          <Input label="Email" type="email" value={f.email} onChange={set("email")} required autoComplete="username" />
          <Input label="Password" type="password" value={f.password} onChange={set("password")} required autoComplete="current-password" />
          <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {!superadmin && <p className="hint">New here? Open the activation link in your email to set your password first.</p>}
        </form>
      </section>
    </div>
  );
}
