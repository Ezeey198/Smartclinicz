// Only this clinic's (or pharmacy's) admin manages what the public sees: details, services, locations, photos and videos.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { resizeImage } from "../../components/imageTools";
import { mediaUrl } from "../../pages/public/media";
import { Input, Notice, PageHead, Spinner } from "../../components/ui";

export default function PublicPage() {
  const [d, setD] = useState(null);
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [cap, setCap] = useState("");
  const [v, setV] = useState({ title: "", url: "" });
  const [vf, setVf] = useState(null);
  useEffect(() => { api.get("/clinic/public").then((r) => { setD(r.data); setP(r.data.profile); }).catch((e) => setMsg({ tone: "error", text: errMsg(e) })); }, []);
  if (!d || !p) return msg ? <Notice tone="error">{msg.text}</Notice> : <Spinner />;

  const flash = (tone, text) => setMsg({ tone, text });
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const upd = (list, i, k, val) => setP({ ...p, [list]: p[list].map((x, j) => (j === i ? { ...x, [k]: val } : x)) });
  const add = (list, blank) => setP({ ...p, [list]: [...p[list], blank] });
  const del = (list, i) => setP({ ...p, [list]: p[list].filter((_, j) => j !== i) });

  const save = async () => {
    setBusy("save");
    try { const { data } = await api.put("/clinic/public", { ...p, services: p.services.filter((s) => s.name.trim()), locations: p.locations.filter((l) => l.address.trim()) }); setD(data); setP(data.profile); flash("success", "Saved. The public page is updated."); }
    catch (x) { flash("error", errMsg(x)); } finally { setBusy(""); }
  };
  const photos = async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    setBusy("photo");
    try {
      for (const f of files) { const fd = new FormData(); fd.append("file", await resizeImage(f), "photo.jpg"); fd.append("caption", cap); setD((await api.post("/clinic/public/photos", fd)).data); }
      setCap(""); flash("success", `${files.length} photo(s) added.`);
    } catch (x) { flash("error", x.response ? errMsg(x) : x.message); } finally { setBusy(""); }
  };
  const video = async (e) => {
    e.preventDefault(); setBusy("video");
    try { const fd = new FormData(); fd.append("title", v.title); if (vf) fd.append("file", vf); else fd.append("url", v.url); setD((await api.post("/clinic/public/videos", fd)).data); setV({ title: "", url: "" }); setVf(null); flash("success", "Video added."); }
    catch (x) { flash("error", errMsg(x)); } finally { setBusy(""); }
  };
  const remove = async (id) => { if (window.confirm("Remove this?")) { try { setD((await api.delete(`/clinic/public/media/${id}`)).data); } catch (x) { flash("error", errMsg(x)); } } };

  return (
    <>
      <PageHead title="Public page" sub={`What the public sees about your ${d.type}. Only you can change it.`}>
        <Link className="btn ghost" to={`/clinics/${d.code}`} target="_blank">View public page</Link><button className="btn primary" onClick={save} disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save details"}</button></PageHead>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="panel pad">
        <h3 style={{ marginBottom: 12 }}>Details</h3>
        <div className="grid2">
          <Input label="Show on the public Clinics page?"><select className="input" value={p.listed ? "yes" : "no"} onChange={(e) => setP({ ...p, listed: e.target.value === "yes" })}><option value="yes">Yes, show it</option><option value="no">No, keep it hidden</option></select></Input>
          <Input label="Show my phone, email and website?"><select className="input" value={p.show_contact ? "yes" : "no"} onChange={(e) => setP({ ...p, show_contact: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></Input>
          <Input full label="Tagline (one line)" value={p.tagline || ""} onChange={set("tagline")} maxLength={160} />
          <Input full label="About us"><textarea className="input" rows={4} value={p.about || ""} onChange={set("about")} /></Input>
          <Input full label="Opening hours" value={p.hours || ""} onChange={set("hours")} placeholder="Mon to Sat 8:00 to 18:00" />
        </div>
      </div>

      <h3 className="section">Services</h3>
      <div className="panel pad">
        {p.services.map((s, i) => (
          <div className="line pline" key={i}>
            <input className="input" style={{ flex: "2 1 180px" }} placeholder="Service, e.g. Malaria test" value={s.name} onChange={(e) => upd("services", i, "name", e.target.value)} />
            <input className="input" style={{ flex: "3 1 240px" }} placeholder="Short description" value={s.description || ""} onChange={(e) => upd("services", i, "description", e.target.value)} />
            <input className="input" style={{ flex: "1 1 110px" }} placeholder="Price (optional)" value={s.price || ""} onChange={(e) => upd("services", i, "price", e.target.value)} />
            <button className="icon-btn danger" title="Remove" onClick={() => del("services", i)}><Trash2 size={16} /></button>
          </div>))}
        <button className="btn ghost sm" onClick={() => add("services", { name: "", description: "", price: "" })}>+ Add service</button>
      </div>

      <h3 className="section">Locations</h3>
      <div className="panel pad">
        <p className="hint" style={{ marginTop: 0 }}>Leave this empty to use the address in your clinic settings.</p>
        {p.locations.map((l, i) => (
          <div className="loc-edit" key={i}>
            <div className="grid2">
              <Input label="Name" value={l.label || ""} onChange={(e) => upd("locations", i, "label", e.target.value)} placeholder="Main branch" />
              <Input label="Town or city" value={l.city || ""} onChange={(e) => upd("locations", i, "city", e.target.value)} />
              <Input full label="Street address" value={l.address} onChange={(e) => upd("locations", i, "address", e.target.value)} />
              <Input label="Opening hours" value={l.hours || ""} onChange={(e) => upd("locations", i, "hours", e.target.value)} />
              <Input label="Phone" value={l.phone || ""} onChange={(e) => upd("locations", i, "phone", e.target.value)} />
              <Input full label="Map link (optional)" value={l.map_url || ""} onChange={(e) => upd("locations", i, "map_url", e.target.value)} hint="Paste a Google Maps link if you want directions to use an exact pin." />
            </div>
            <button className="btn danger sm" onClick={() => del("locations", i)}>Remove this location</button>
          </div>))}
        <button className="btn ghost sm" onClick={() => add("locations", { label: "", address: "", city: "", hours: "", phone: "", map_url: "" })}>+ Add location</button>
      </div>
      <div className="row" style={{ margin: "16px 0" }}><button className="btn primary" onClick={save} disabled={busy === "save"}>Save details</button></div>

      <h3 className="section">Photos ({d.photos.length}/30)</h3>
      <div className="panel pad">
        <div className="row" style={{ alignItems: "end" }}>
          <Input label="Caption for the next photos (optional)" value={cap} onChange={(e) => setCap(e.target.value)} />
          <label className="btn primary" style={{ cursor: "pointer", marginBottom: 14 }}>{busy === "photo" ? "Uploading…" : "Upload photos"}<input type="file" accept="image/*" multiple hidden onChange={photos} disabled={busy === "photo"} /></label>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>Photos are shrunk automatically. The first photo is the cover.</p>
        <div className="gallery">{d.photos.map((ph) => <div key={ph.id} className="gal-item"><img src={mediaUrl(ph.id)} alt={ph.caption || ""} /><button className="icon-btn danger" title="Delete" onClick={() => remove(ph.id)}><Trash2 size={16} /></button>{ph.caption && <span>{ph.caption}</span>}</div>)}</div>
      </div>

      <h3 className="section">Videos ({d.videos.length}/8)</h3>
      <div className="panel pad">
        <form onSubmit={video}>
          <div className="grid2">
            <Input label="Title (optional)" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
            <Input label="YouTube or Vimeo link" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} disabled={!!vf} placeholder="https://www.youtube.com/watch?v=…" />
            <Input full label="Or upload a video file (MP4 or WebM, up to 25 MB)"><input className="input" type="file" accept="video/mp4,video/webm" onChange={(e) => setVf(e.target.files?.[0] || null)} /></Input>
          </div>
          <button className="btn primary" disabled={busy === "video" || (!vf && !v.url.trim())}>{busy === "video" ? "Adding…" : "Add video"}</button>
        </form>
        <div className="video-grid" style={{ marginTop: 16 }}>{d.videos.map((vd) => (
          <figure key={vd.id}><div className="video-frame">{vd.source === "file" || vd.source === "direct" ? <video controls preload="metadata" src={vd.source === "file" ? mediaUrl(vd.id) : vd.url} /> : <iframe src={vd.url} title={vd.title || "Video"} allowFullScreen loading="lazy" />}</div>
            <figcaption>{vd.title || "Video"} <button className="icon-btn danger" title="Delete" onClick={() => remove(vd.id)}><Trash2 size={15} /></button></figcaption></figure>))}</div>
      </div>
    </>
  );
}
