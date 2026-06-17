import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `netlify dev`, the functions server runs on :8888 and proxies /api/*
// to the bundled functions. In plain `vite dev` (no Netlify), point /api at the
// Netlify dev server if it's running; otherwise the calls will 404 — run
// `npm run netlify` for the full stack.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
      },
    },
  },
});
