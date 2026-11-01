import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api";
import { useAuth } from "../../auth";
import Stamp from "../../components/Stamp";
import { drawScaled, extractStamp, loadImage } from "../../components/stampProcessing";
import { Empty, Input, Notice, PageHead, Pill, Spinner, fmtStamp, label } from "../../components/ui";

export default function ClinicStamp() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(null);
  const [log, setLog] = useState([]);
  const [img, setImg] = useState(null);
  const [rot, setRot] = useState(0);
  const [sens, setSens] = useState(55);
  const [ink, setInk] = useState("original");
  const [result, setResult] = useState(null);
  const [orig, setOrig] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef();

  const load = () => { api.get("/stamps/clinic").then((r) => setSaved(r.data)); api.get("/stamps/log").then((r) => setLog(r.data)); };
  useEffect(load, []);

  useEffect(() => {   // redo the clean-up whenever the photo, rotation, sensitivity or colour changes
    if (!img) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const c = drawScaled(img, rot);
      setOrig(c.toDataURL("image/jpeg", 0.7));
      setResult(extractStamp(c, { sensitivity: sens, ink }));
    }, 120);
    return () => clearTimeout(timer.current);
  }, [img, rot, sens, ink]);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg(null);
    try { setImg(await loadImage(f)); setRot(0); } catch (x) { setMsg({ tone: "error", text: x.message }); }
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api.put("/stamps/clinic", { image: result.dataUrl, ink: result.ink }); setMsg({ tone: "success", text: "The clinic stamp is saved. Staff can now stamp documents with it." }); setImg(null); setResult(null); load(); }
    catch (x) { setMsg({ tone: "error", text: errMsg(x) }); } finally { setBusy(false); }
  };
  const remove = async () => { if (window.confirm("Remove the clinic stamp? Documents already stamped keep their record.")) { await api.delete("/stamps/clinic"); load(); } };
  if (!saved) return <Spinner />;

  return (
    <>
      <PageHead title="Clinic stamp" sub="Upload a photo of your clinic's stamp. It is cleaned up into a digital stamp that staff use on documents, with the date filled in automatically." />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="stamp-grid">
        <div className="panel pad">
          <h3 style={{ marginBottom: 12 }}>1. Upload a photo of the stamp</h3>
          <p className="hint" style={{ marginTop: 0 }}>Stamp it on plain white paper, in good light, and photograph it straight on. The stamp should fill most of the photo.</p>
          <input className="input" type="file" accept="image/*" onChange={pick} />
          {img && (
            <>
              <div className="row" style={{ margin: "14px 0" }}>
                <button className="btn ghost sm" onClick={() => setRot((rot + 270) % 360)}><RotateCcw size={14} /> Rotate left</button>
                <button className="btn ghost sm" onClick={() => setRot((rot + 90) % 360)}><RotateCw size={14} /> Rotate right</button>
              </div>
              <Input label={`Ink detail: ${sens}`} hint="Raise it if parts of the stamp are missing. Lower it if paper marks or shadows show up.">
                <input type="range" min="10" max="95" value={sens} onChange={(e) => setSens(Number(e.target.value))} /></Input>
              <Input label="Ink colour"><select className="input" value={ink} onChange={(e) => setInk(e.target.value)}>
                <option value="original">Keep the stamp's own colours</option><option value="blue">Blue</option><option value="red">Red</option><option value="violet">Violet</option><option value="black">Black</option></select></Input>
              <div className="stamp-compare">
                <div><span className="sub">Your photo</span><img src={orig} alt="Photo of the stamp" /></div>
                <div><span className="sub">Digital stamp</span>
                  <div className="checker">{result ? <img src={result.dataUrl} alt="Digital stamp" /> : <p className="sub" style={{ padding: 20 }}>No stamp found. Raise the ink detail or use a clearer photo.</p>}</div></div>
              </div>
            </>
          )}
        </div>
        <div className="panel pad">
          <h3 style={{ marginBottom: 12 }}>2. How it will look on a document</h3>
          {(result || saved.has_stamp) ? (
            <>
              <div className="stamp-preview"><Stamp image={result ? result.dataUrl : saved.image} ink={result ? result.ink : saved.ink} name={user.full_name} role={user.role_label} /></div>
              <p className="hint">Today's date is added automatically each time someone stamps a document, and the name of the person who stamps goes underneath.</p>
              {result && <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : saved.has_stamp ? "Replace the clinic stamp" : "Save as the clinic stamp"}</button>}
              {saved.has_stamp && !result && <button className="btn danger" onClick={remove}><Trash2 size={16} />Remove stamp</button>}
            </>
          ) : <Empty text="Upload a photo to see the digital stamp." />}
        </div>
      </div>
      <h3 className="section">Stamp history</h3>
      <div className="panel">
        {log.length === 0 ? <Empty text="No documents have been stamped yet." /> : (
          <div className="scroll"><table className="table"><thead><tr><th>When</th><th>Document</th><th>Stamped by</th></tr></thead>
            <tbody>{log.map((u) => <tr key={u.id}><td className="sub">{fmtStamp(u.stamped_at)}</td><td><b>{u.doc_ref}</b> <Pill tone="gray">{label(u.doc_type)}</Pill></td><td>{u.user_name}<div className="sub">{u.role_label}</div></td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}
