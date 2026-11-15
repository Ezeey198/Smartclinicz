import { useRef, useState } from "react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import Avatar from "../../components/Avatar";
import ClockIn from "../../components/ClockIn";
import { Band, Input, Notice, PageHead } from "../../components/ui";

// Crops the chosen picture to a square and shrinks it, so it stays small and looks right in the circle.
const shrink = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const s = Math.min(img.width, img.height), c = document.createElement("canvas");
    c.width = c.height = 256;
    c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
    resolve(c.toDataURL("image/jpeg", 0.85));
  };
  img.onerror = () => reject(new Error("That file is not a picture."));
  img.src = URL.createObjectURL(file);
});

export default function Profile() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ full_name: user.full_name || "", phone: user.phone || "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [msg, setMsg] = useState({});
  const pick = useRef(null);
  const say = (k, tone, text) => setMsg((m) => ({ ...m, [k]: { tone, text } }));

  const savePhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await api.put("/profile/avatar", { image: await shrink(file) }); await refresh(); say("pic", "success", "Your picture was updated."); }
    catch (x) { say("pic", "error", errMsg(x)); }
  };
  const removePhoto = async () => { try { await api.delete("/profile/avatar"); await refresh(); say("pic", "success", "Picture removed."); } catch (x) { say("pic", "error", errMsg(x)); } };
  const saveInfo = async (e) => { e.preventDefault(); try { await api.patch("/profile", f); await refresh(); say("info", "success", "Your details were saved."); } catch (x) { say("info", "error", errMsg(x)); } };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api.post("/auth/change-password", pw); setPw({ current_password: "", new_password: "" }); say("pw", "success", "Password changed."); } catch (x) { say("pw", "error", errMsg(x)); }
  };
  const Msg = ({ k }) => (msg[k] ? <Notice tone={msg[k].tone}>{msg[k].text}</Notice> : null);

  return (
    <>
      <PageHead title="My profile" sub="Your picture, personal details and password." />
      <div className="panel pad narrow" style={{ marginBottom: 20 }}>
        <div className="profile-pic">
          <Avatar user={user} size={96} />
          <div>
            <b>{user.full_name}</b><div className="sub">{user.role_label}</div>
            {user.clinic && <div style={{ marginTop: 6 }}><Band code={user.clinic.code} /> <span className="sub">{user.clinic.name}</span></div>}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => pick.current.click()}>Upload picture</button>
              {user.avatar && <button className="btn ghost sm" onClick={removePhoto}>Remove</button>}
              <input ref={pick} type="file" accept="image/*" hidden onChange={savePhoto} />
            </div>
          </div>
        </div>
        <Msg k="pic" />
        <p className="hint" style={{ marginBottom: 0 }}>Your picture shows in a circle at the top right of every page. Click it any time to come back here.</p>
      </div>

      <div className="panel pad narrow" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Personal information</h3>
        <form onSubmit={saveInfo}>
          <Input label="Full name" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input label="Phone (notifications are also sent here by SMS)" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input label="Email" value={user.email} disabled hint="Your email cannot be changed." />
          <Msg k="info" />
          <button className="btn primary">Save details</button>
        </form>
      </div>

      {!user.is_superadmin && (
        <div className="panel pad narrow" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 6 }}>Attendance</h3>
          <p className="sub" style={{ marginTop: 0 }}>Clock in when you arrive. You must be within 20 metres of the {user.clinic?.clinic_class === "P" ? "pharmacy" : "clinic"}.</p>
          <ClockIn full />
        </div>
      )}

      <div className="panel pad narrow">
        <h3 style={{ marginBottom: 10 }}>Change password</h3>
        <form onSubmit={savePw}>
          <Input label="Current password" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <Input label="New password" type="password" minLength={8} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} hint="At least 8 characters." />
          <Msg k="pw" />
          <button className="btn primary">Change password</button>
        </form>
      </div>
    </>
  );
}
