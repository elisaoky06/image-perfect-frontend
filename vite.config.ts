import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Shared dev + preview: without this, `vite preview` has no `/api` upstream (relative calls 500). */
/** Do not override multipart headers in `configure` — forcing Content-Length/Type can break uploads. */
const apiProxy: Record<string, string | ProxyOptions> = {
  "/api": {
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
    timeout: 120000,
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
