import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Band, Input, Notice, PageHead, Spinner } from "../../components/ui";

const FIELDS = [["name", "Clinic name", true], ["registration_number", "Registration number"], ["license_number", "Health licence number"], ["email", "Clinic email"],
  ["phone", "Clinic phone"], ["website", "Website"], ["address", "Street address", true], ["city", "Town or city"], ["district", "District or region"], ["country", "Country"]];

export default function ClinicSettings() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.get("/clinic/profile").then((r) => setF(r.data)); }, []);
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { setF((await api.patch("/clinic/profile", f)).data); setMsg({ tone: "success", text: "Clinic details saved." }); } catch (x) { setMsg({ tone: "error", text: errMsg(x) }); }
  };
  return (
    <>
      <PageHead title="Clinic settings" sub="Your clinic's profile." />
      <div className="panel pad">
        <div className="detail-top"><Band code={f.code} cls={f.clinic_class} size="lg" />
          <span className="sub">{f.clinic_class === "A" ? "Class A: full service" : "Class B: essential"}. The code and class are set by the system administrator.</span></div>
        <form onSubmit={save}>
          <div className="grid2">{FIELDS.map(([k, l, full]) => <Input key={k} full={full} label={l} value={f[k] || ""} onChange={set(k)} />)}
            <Input full label="About the clinic"><textarea className="input" rows={3} value={f.description || ""} onChange={set("description")} /></Input></div>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="modal-foot"><button className="btn primary">Save clinic details</button></div>
        </form>
      </div>
    </>
  );
}
