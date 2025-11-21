import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Route all `import { toast } from "sonner"` to our local wrapper
      sonner: path.resolve(__dirname, "./src/components/ui/sonner.tsx"),
      // Ensure single React instance
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react-router": path.resolve(__dirname, "./node_modules/react-router"),
      "react-router-dom": path.resolve(__dirname, "./node_modules/react-router-dom"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router", "react-router-dom"],
    esbuildOptions: {
      // Ensure consistent React instance during pre-bundling
      define: { "process.env.NODE_ENV": JSON.stringify(mode) },
    },
  },
}));
