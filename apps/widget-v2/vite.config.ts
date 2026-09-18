import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Not Vite's default 5173: that port is contested by other local projects,
    // and when one of them wins, the dashboard's preview silently loads *their*
    // site instead of the widget — a spinner and a stranger's stack trace.
    port: 5174,
    // Fail instead of drifting to the next free port. Drifting is what makes
    // the collision hard to diagnose: the dashboard keeps asking for the
    // configured port and gets whatever else is squatting there.
    strictPort: true,
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
