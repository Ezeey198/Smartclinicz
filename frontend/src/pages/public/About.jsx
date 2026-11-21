import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../auth";
import { Spinner } from "../../components/ui";
import AboutEditor from "./AboutEditor";

export default function About() {
  const { user } = useAuth();
  const [a, setA] = useState(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => { api.get("/public/about").then((r) => setA(r.data)); }, []);
  if (!a) return <Spinner />;
  return (
    <div className="pub-wrap pub-section">
      <div className="pub-row"><h1>{a.title}</h1>{user?.is_superadmin && <button className="btn ghost" onClick={() => setEdit(true)}><Pencil size={15} />Edit about</button>}</div>
      <p className="pub-lead">{a.intro}</p>
      <div className="pub-articles">{a.sections.map((s) => <article key={s.heading}><h3>{s.heading}</h3><p>{s.text}</p></article>)}</div>
      {edit && <AboutEditor about={a} onClose={() => setEdit(false)} onSaved={(d) => { setA(d); setEdit(false); }} />}
    </div>
  );
}
