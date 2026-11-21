// Turning what was spoken into the kind of value the field accepts: words/sentences, whole numbers, decimals or phone digits.
const UNITS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { thousand: 1e3, million: 1e6, billion: 1e9 };

const clean = (t) => String(t || "").toLowerCase().replace(/[,]/g, " ").replace(/\band\b/g, " ").replace(/\bpoint\b|\bdot\b/g, " . ").replace(/\bminus\b|\bnegative\b/g, " - ").replace(/\s+/g, " ").trim();

// "twelve point five" -> 12.5, "one hundred twenty three" -> 123, "12.5" -> 12.5, "1 200" -> 1200. Returns null when no number was said.
export function spokenToNumber(text) {
  const t = clean(text);
  if (!t) return null;
  const digits = t.replace(/(\d)\s+(?=\d{3}\b)/g, "$1").match(/-?\d+(\.\d+)?/);
  if (digits && !/[a-z]/.test(t.replace(/[-.\d\s]/g, ""))) return Number(digits[0]);
  let neg = false, total = 0, cur = 0, frac = "", inFrac = false, seen = false;
  for (const w of t.split(" ")) {
    if (w === "-") { neg = true; continue; }
    if (w === ".") { inFrac = true; continue; }
    if (/^\d+$/.test(w)) { seen = true; if (inFrac) frac += w; else cur += Number(w); continue; }
    if (w in UNITS) { seen = true; if (inFrac) frac += String(UNITS[w]); else cur += UNITS[w]; }
    else if (w in TENS) { seen = true; cur += TENS[w]; }
    else if (w === "hundred") { seen = true; cur = (cur || 1) * 100; }
    else if (w in SCALE) { seen = true; total += (cur || 1) * SCALE[w]; cur = 0; }
  }
  if (!seen) return null;
  const n = Number(`${total + cur}${frac ? "." + frac : ""}`);
  return neg ? -n : n;
}

// Spoken phone digits: "zero seven seven zero one two three" -> "0770123".
export function spokenToDigits(text) {
  const out = [];
  for (const w of clean(text).split(" ")) {
    if (/^\+?\d+$/.test(w)) out.push(w);
    else if (w in UNITS) out.push(String(UNITS[w]));
    else if (w === "plus") out.push("+");
  }
  return out.join("");
}

const sentence = (t) => { const s = String(t || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };

export const NEVER = ["password", "email", "hidden", "file", "checkbox", "radio", "date", "datetime-local", "time", "month", "week", "color", "range", "submit", "button", "reset", "image"];

// What kind of value this field takes: "text" (words and sentences), "int", "float", "digits" (phone), or null when voice must not be offered (passwords, emails, dates...).
export function fieldKind(el) {
  if (!el) return null;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return "text";
  if (tag !== "INPUT") return null;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  if (NEVER.includes(type) || el.readOnly || el.disabled) return null;
  if (type === "number") { const s = el.getAttribute("step"); return s === "any" || (s && s.includes(".")) ? "float" : "int"; }
  if (type === "tel") return "digits";
  const mode = (el.getAttribute("inputmode") || "").toLowerCase();
  if (mode === "decimal") return "float";
  if (mode === "numeric") return "int";
  return "text";
}

// Returns { value } to put into the field, or { error } to show the person. Restrictions on the field (length, pattern, min, max) are respected.
export function transcriptToValue(el, kind, heard, existing = "") {
  if (kind === "int" || kind === "float") {
    const n = spokenToNumber(heard);
    if (n === null) return { error: "I did not hear a number. Say it again, for example “twelve point five”." };
    const v = kind === "int" ? Math.round(n) : n;
    const min = el.getAttribute("min"), max = el.getAttribute("max");
    if (min !== null && min !== "" && v < Number(min)) return { error: `That is below the lowest allowed value (${min}).` };
    if (max !== null && max !== "" && v > Number(max)) return { error: `That is above the highest allowed value (${max}).` };
    return { value: String(v) };
  }
  if (kind === "digits") {
    const d = spokenToDigits(heard);
    return d ? { value: d.slice(0, Number(el.getAttribute("maxlength")) || 20) } : { error: "I did not hear a phone number." };
  }
  const isArea = el.tagName === "TEXTAREA";
  let v = isArea && existing.trim() ? `${existing.trim()} ${heard.trim()}` : sentence(heard);
  const max = Number(el.getAttribute("maxlength"));
  if (max > 0) v = v.slice(0, max);
  const pattern = el.getAttribute("pattern");
  if (pattern && !new RegExp(`^(?:${pattern})$`).test(v)) return { error: "What I heard does not fit what this field accepts." };
  return { value: v };
}

// Puts a value into a React-controlled field and lets React know.
export function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
