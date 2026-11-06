// Shrinks a photo in the browser before it is uploaded, so phone photos (often 5 MB or more) become a few hundred KB.
export function resizeImage(file, max = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process that photo."))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("That file is not a photo this browser can open."));
    img.src = url;
  });
}
