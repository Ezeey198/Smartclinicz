// Only the superadmin sees this: edit the landing headline, the About page and the Clinics page text.
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { Input, Modal, Notice } from "../../components/ui";

function ListEditor({ title, items, setItems }) {
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setItems(n); };
  const upd = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <p className="group-title">{title}</p>
      {items.map((it, i) => (
        <div className="panel pad" key={i} style={{ marginBottom: 10 }}>
          <Input label="Heading" value={it.heading} onChange={(e) => upd(i, "heading", e.target.value)} />
          <Input label="Text"><textarea className="input" rows={3} value={it.text} onChange={(e) => upd(i, "text", e.target.value)} /></Input>
          <div className="row"><button type="button" className="icon-btn" title="Move up" onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
            <button type="button" className="icon-btn" title="Move down" onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
            <button type="button" className="icon-btn danger" title="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>
        </div>))}
      <button type="button" className="btn ghost sm" onClick={() => setItems([...items, { heading: "", text: "" }])}>+ Add</button>
    </>
  );
}

export default function AboutEditor({ about, onClose, onSaved }) {
  const [f, setF] = useState({ headline: about.headline, title: about.title, intro: about.intro, clinics_intro: about.clinics_intro });
  const [sections, setSections] = useState(about.sections);
  const [features, setFeatures] = useState(about.features);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const { data } = await api.put("/public/about", { ...f, sections: sections.filter((s) => s.heading.trim() || s.text.trim()), features: features.filter((s) => s.heading.trim() || s.text.trim()) }); onSaved(data); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Edit the public website text" onClose={onClose} wide>
      <form onSubmit={save}>
        <Input label="Landing page headline" value={f.headline} onChange={set("headline")} required />
        <Input label="About page title" value={f.title} onChange={set("title")} required />
        <Input label="About page introduction"><textarea className="input" rows={3} value={f.intro} onChange={set("intro")} required /></Input>
        <ListEditor title="About page sections" items={sections} setItems={setSections} />
        <p className="group-title">Clinics page</p>
        <Input label="Introduction to clinics and pharmacies"><textarea className="input" rows={3} value={f.clinics_intro} onChange={set("clinics_intro")} required /></Input>
        <ListEditor title="Features of clinics and pharmacies" items={features} setItems={setFeatures} />
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </Modal>
  );
}
