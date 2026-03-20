import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";
import https from "https";
import http from "http";

// Routes served by Supabase edge functions on Vercel — proxy these to staging
// so local dev shows the real rendered output instead of the React SPA fallback.
const STAGING = "staging.top10lists.us";
const EDGE_ROUTES = [
  /^\/about\/founder\/?$/,
  /^\/transparency\/?$/,
  /^\/faq\/?$/,
  /^\/methodology\/?$/,
  /^\/crawl-stats\/?$/,
  /^\/why-ai-trusts-us\/?$/,
  /^\/(arizona|california|texas|florida|new-york|colorado)\/top10realestateagents\/?$/,
  /^\/(arizona|california|texas|florida|new-york|colorado)\/[^/]+\/top10realestateagents\/?/,
  /^\/(arizona|california|texas|florida|new-york|colorado)\/[^/]+\/[^/]+\/top10realestateagents\/?/,
  /^\/(arizona|california|texas|florida|new-york|colorado)\/agents\/[^/]+\/?$/,
];

function proxyToStaging(req: http.IncomingMessage, res: http.ServerResponse) {
  const options = {
    hostname: STAGING,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: STAGING },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => res.end("Proxy error"));
  req.pipe(proxyReq);
}

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
    mode === "development" && {
      name: "dev-routing",
      configureServer(server: import("vite").ViteDevServer) {
        server.middlewares.use((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => {
          const url = req.url?.split("?")[0] ?? "/";

          // Root: serve local _home.html
          if (url === "/") {
            const homePath = path.resolve(__dirname, "public/_home.html");
            if (fs.existsSync(homePath)) {
              res.setHeader("Content-Type", "text/html");
              res.end(fs.readFileSync(homePath, "utf-8"));
              return;
            }
          }

          // Edge-function routes: proxy to staging
          if (EDGE_ROUTES.some((re) => re.test(url))) {
            proxyToStaging(req, res);
            return;
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
