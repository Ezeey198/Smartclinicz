// Turns a photo of a stamp into a clean transparent PNG, entirely in the browser (nothing is uploaded until you save).
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = url;
  });
}

// Draws the photo (rotated by 0/90/180/270 degrees) onto a canvas no bigger than maxSide pixels.
export function drawScaled(img, rotation = 0, maxSide = 900) {
  const swap = rotation % 180 !== 0;
  let w = swap ? img.height : img.width, h = swap ? img.width : img.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2); g.rotate((rotation * Math.PI) / 180);
  const iw = Math.round(img.width * k), ih = Math.round(img.height * k);
  g.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  return c;
}

const median = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1] || 255; };
const INKS = { blue: [27, 58, 138], red: [190, 30, 45], black: [25, 25, 30], violet: [88, 44, 140] };
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

// sensitivity 10..95: higher keeps fainter ink. ink: "original" keeps the stamp's own colours, or blue/red/black/violet.
export function extractStamp(src, { sensitivity = 55, ink = "original" } = {}) {
  const w = src.width, h = src.height;
  const data = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;

  // paper colour = median colour of the outer edge of the photo
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const R = [], G = [], B = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < band || y < band || x >= w - band || y >= h - band) { const i = (y * w + x) * 4; R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]); }
  }
  const pr = median(R), pg = median(G), pb = median(B);

  const lo = 0.04 + ((100 - sensitivity) / 100) * 0.26, hi = lo + 0.16;
  const out = new ImageData(w, h);
  const o = out.data;
  const fixed = INKS[ink];
  let minX = w, minY = h, maxX = -1, maxY = -1, sr = 0, sg = 0, sb = 0, sa = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = (Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b)) / 765;
    let a = (d - lo) / (hi - lo);
    a = a <= 0.1 ? 0 : Math.min(1, a);
    if (a === 0) continue;
    let cr, cg, cb;
    if (fixed) { [cr, cg, cb] = fixed; }
    else { // take the paper out of the colour so the ink comes out clean
      cr = Math.max(0, Math.min(255, (r - pr * (1 - a)) / a)); cg = Math.max(0, Math.min(255, (g - pg * (1 - a)) / a)); cb = Math.max(0, Math.min(255, (b - pb * (1 - a)) / a));
    }
    o[i] = cr; o[i + 1] = cg; o[i + 2] = cb; o[i + 3] = Math.round(a * 255);
    if (a > 0.25) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      sr += cr * a; sg += cg * a; sb += cb * a; sa += a;
    }
  }
  if (maxX < 0 || sa < 40) return null;   // nothing that looks like ink

  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const full = document.createElement("canvas"); full.width = w; full.height = h; full.getContext("2d").putImageData(out, 0, 0);
  const cw = maxX - minX + 1, ch = maxY - minY + 1, k = Math.min(1, 520 / Math.max(cw, ch));
  const c = document.createElement("canvas"); c.width = Math.max(60, Math.round(cw * k)); c.height = Math.max(60, Math.round(ch * k));
  c.getContext("2d").drawImage(full, minX, minY, cw, ch, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/png"), ink: hex(sr / sa, sg / sa, sb / sa) };
}
