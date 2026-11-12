import axios from "axios";
import { store } from "./storage";

export const TOKEN_KEY = "clinicpro_token";
// Where the backend lives. Order: VITE_API_URL if it is set, otherwise the Vercel backend project when the website is opened from
// any real address, otherwise "/api" (local development, where the Vite proxy forwards it).
const BACKEND_URL = "https://smartclinicz.vercel.app";
let origin = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
if (origin && !/^https?:\/\//.test(origin)) origin = "https://" + origin;
const onThisComputer = typeof window !== "undefined" && /^(localhost$|127\.|192\.168\.|10\.)/.test(window.location.hostname);
if (!origin && !onThisComputer) origin = BACKEND_URL;
export const API_BASE = origin ? `${origin}/api` : "/api";
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((c) => {
  const t = store.get(TOKEN_KEY);
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// Only the signed-in workspace (/app, /super) is sent to the sign-in page. The public website, including the landing page, never is.
const signInPage = () => (window.location.pathname.startsWith("/super") ? "/superadmin" : "/login");
const inWorkspace = () => /^\/(app|super)(\/|$)/.test(window.location.pathname);

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const url = e.config?.url || "";
    if (e.response?.status === 401 && store.get(TOKEN_KEY) && !url.includes("/auth/login")) {
      store.del(TOKEN_KEY);
      if (inWorkspace()) window.location.href = signInPage();
    }
    if (e.response?.status === 403 && String(e.response?.data?.detail || "").includes("deactivated by the system administrator") && store.get(TOKEN_KEY)) {
      store.del(TOKEN_KEY);
      if (inWorkspace()) window.location.assign(signInPage());
    }
    if (e.response?.status === 402 && store.get(TOKEN_KEY) && inWorkspace()) window.location.assign("/app");
    return Promise.reject(e);
  }
);

export const errMsg = (e) => {
  if (e.response?.status === 413) return "That file is too large for the server. Use a smaller file, or add a YouTube or Vimeo link for videos.";
  const d = e.response?.data?.detail;
  if (!d) return e.message || "Something went wrong. Try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${String(x.loc?.slice(-1)[0] || "").replace(/_/g, " ")}: ${x.msg}`).join(". ");
  return "Something went wrong. Try again.";
};

export default api;
