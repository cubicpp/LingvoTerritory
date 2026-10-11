import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/",
  plugins: [react()],
  publicDir: "public",
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-d3": ["d3"],
          "vendor-echarts": ["echarts"],
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  assetsInclude: ["**/*.wasm"],
});
