import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true listens on IPv4 so Firefox and Chrome can both reach http://localhost:5173
// (Node 18+ otherwise binds "localhost" to IPv6 only, which Firefox may not fall back from).
// The API proxy uses 127.0.0.1 because uvicorn listens on IPv4 by default.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:8000" } },
  preview: { host: true, port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
