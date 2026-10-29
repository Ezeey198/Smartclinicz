import axios from "axios";
import { store } from "./storage";

export const TOKEN_KEY = "clinicpro_token";

const API_URL = (
  import.meta.env.VITE_API_URL || "https://smartclinicz.vercel.app"
).trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = store.get(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";

    if (
      error.response?.status === 401 &&
      store.get(TOKEN_KEY) &&
      !url.includes("/auth/login")
    ) {
      store.del(TOKEN_KEY);
      window.location.href = "/login";
    }

    if (error.response?.status === 402 && store.get(TOKEN_KEY)) {
      window.location.assign("/app");
    }

    return Promise.reject(error);
  }
);

export const errMsg = (error) => {
  const detail = error.response?.data?.detail;

  if (!detail) {
    return error.message || "Something went wrong. Try again.";
  }

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = String(item.loc?.slice(-1)[0] || "").replace(/_/g, " ");
        return `${field}: ${item.msg}`;
      })
      .join(". ");
  }

  return "Something went wrong. Try again.";
};

export default api;