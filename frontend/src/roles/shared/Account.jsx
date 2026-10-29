import { useState } from "react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import { Band, Input, Notice, PageHead } from "../../components/ui";

export default function Account() {
  const { user } = useAuth();
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post("/auth/change-password", pw); setPw({ current_password: "", new_password: "" }); setMsg({ tone: "success", text: "Password changed." }); }
    catch (x) { setMsg({ tone: "error", text: errMsg(x) }); }
  };
  return (
    <>
      <PageHead title="My account" sub="Your details and password." />
      <div className="panel pad narrow" style={{ marginBottom: 20 }}>
        <dl className="facts">
          <dt>Name</dt><dd>{user.full_name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role_label}</dd>
          {user.clinic && (<><dt>Clinic</dt><dd>{user.clinic.name}</dd><dt>Clinic code</dt><dd><Band code={user.clinic.code} cls={user.clinic.clinic_class} /></dd></>)}
        </dl>
      </div>
      <div className="panel pad narrow">
        <form onSubmit={submit}>
          <Input label="Current password" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <Input label="New password" type="password" minLength={8} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} hint="At least 8 characters." />
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <button className="btn primary">Change password</button>
        </form>
      </div>
    </>
  );
}
