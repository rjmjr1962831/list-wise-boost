import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Vite config simplified to avoid duplicate React instances in dev
// Keep only essential settings: dev server, React plugin, and @ alias
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    sourcemap: "hidden",
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Serve public/_home.html for "/" in dev, matching Vercel post-build behavior
    mode === "development" && {
      name: "serve-static-home",
      configureServer(server: import("vite").ViteDevServer) {
        server.middlewares.use((req: import("http").IncomingMessage, res: import("http").ServerResponse, next: () => void) => {
          if (req.url === "/" || req.url === "/?") {
            const homePath = path.resolve(__dirname, "public/_home.html");
            if (fs.existsSync(homePath)) {
              res.setHeader("Content-Type", "text/html");
              res.end(fs.readFileSync(homePath, "utf-8"));
              return;
            }
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

// Cache bust 1770755867
