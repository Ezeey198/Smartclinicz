import axios from "axios";
import { store } from "./storage";

export const TOKEN_KEY = "clinicpro_token";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

api.interceptors.request.use((c) => {
  const t = store.get(TOKEN_KEY);
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const url = e.config?.url || "";

    if (
      e.response?.status === 401 &&
      store.get(TOKEN_KEY) &&
      !url.includes("/auth/login")
    ) {
      store.del(TOKEN_KEY);
      window.location.href = "/login";
    }

    if (e.response?.status === 402 && store.get(TOKEN_KEY)) {
      window.location.assign("/app");
    }

    return Promise.reject(e);
  }
);

export const errMsg = (e) => {
  const d = e.response?.data?.detail;

  if (!d) return e.message || "Something went wrong. Try again.";
  if (typeof d === "string") return d;

  if (Array.isArray(d)) {
    return d
      .map(
        (x) =>
          `${String(x.loc?.slice(-1)[0] || "").replace(/_/g, " ")}: ${x.msg}`
      )
      .join(". ");
  }

  return "Something went wrong. Try again.";
};

export default api;