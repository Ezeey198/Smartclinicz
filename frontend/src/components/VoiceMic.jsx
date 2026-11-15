import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { fieldKind, setNativeValue, transcriptToValue } from "./voice";

const speechEngine = () => (typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null);   // looked up when the button is pressed

// The Speak button next to a field. It listens until pressed again and writes everything said into the field,
// as words, a whole number, a decimal or phone digits, depending on what the field accepts. Passwords and emails never get one.
export default function VoiceMic({ getControl }) {
  const [kind, setKind] = useState(null);
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef(null);
  const heard = useRef("");
  const base = useRef("");
  useEffect(() => { setKind(fieldKind(getControl())); });
  useEffect(() => () => rec.current?.stop?.(), []);
  if (!kind) return null;

  const apply = (el) => {
    const r = transcriptToValue(el, kind, heard.current, base.current);
    if (r.error) { setNote(r.error); return; }
    setNote("");
    setNativeValue(el, r.value);
  };
  const toggle = (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = getControl();
    if (!el) return;
    if (on) { rec.current?.stop(); return; }
    const SR = speechEngine();
    if (!SR) { setNote("Voice input is not supported in this browser. Use Chrome, Edge or Safari."); return; }
    heard.current = ""; base.current = el.value || ""; setNote("");
    const r = new SR();
    r.lang = navigator.language || "en-US"; r.continuous = true; r.interimResults = false;
    r.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) heard.current += " " + ev.results[i][0].transcript; apply(el); };
    r.onerror = (ev) => setNote(ev.error === "not-allowed" ? "Allow the microphone for this website to use voice input." : ev.error === "no-speech" ? "I did not hear anything." : "Voice input stopped.");
    r.onend = () => { setOn(false); rec.current = null; };
    rec.current = r; setOn(true); r.start();
  };
  return (
    <span className="voice">
      <button type="button" className={`mic ${on ? "on" : ""}`} onClick={toggle} title={on ? "Stop" : "Speak"} aria-label={on ? "Stop speaking" : "Speak to fill this field"} aria-pressed={on}>
        {on ? <Square size={14} /> : <Mic size={15} />}<span>{on ? "Stop" : "Speak"}</span>
      </button>
      {note && <small className="voice-note">{note}</small>}
    </span>
  );
}
