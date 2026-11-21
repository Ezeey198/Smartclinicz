// Firefox (with "block all cookies") and some private modes throw when localStorage is touched.
// Fall back to memory so the app still loads; you just have to sign in again after a refresh.
const mem = {};
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete mem[k]; } },
};
