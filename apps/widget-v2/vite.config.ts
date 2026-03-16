import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: true,
  },
  build: {
    outDir: "dist",
    // Optimize for small bundle size
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
