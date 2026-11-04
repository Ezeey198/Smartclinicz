import axios from "axios";
import { store } from "./storage";

export const TOKEN_KEY = "clinicpro_token";
// In development the Vite proxy forwards /api. Online, set VITE_API_URL to the backend's address (https://your-api.example.com).
let origin = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
if (origin && !/^https?:\/\//.test(origin)) origin = "https://" + origin;
export const API_BASE = origin ? `${origin}/api` : "/api";
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((c) => {
  const t = store.get(TOKEN_KEY);
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const url = e.config?.url || "";
    if (e.response?.status === 401 && store.get(TOKEN_KEY) && !url.includes("/auth/login")) {
      store.del(TOKEN_KEY);
      window.location.href = "/login";
    }
    if (e.response?.status === 403 && String(e.response?.data?.detail || "").includes("deactivated by the system administrator") && store.get(TOKEN_KEY)) {
      store.del(TOKEN_KEY);
      window.location.assign("/login");
    }
    if (e.response?.status === 402 && store.get(TOKEN_KEY)) window.location.assign("/app");
    return Promise.reject(e);
  }
);

export const errMsg = (e) => {
  const d = e.response?.data?.detail;
  if (!d) return e.message || "Something went wrong. Try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${String(x.loc?.slice(-1)[0] || "").replace(/_/g, " ")}: ${x.msg}`).join(". ");
  return "Something went wrong. Try again.";
};

export default api;
