import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Packages reached only from the lazy-loaded charts view. Recharts and its
// dependency tree are split so no single chunk exceeds the bundle-size budget.
const CHART_DEPENDENCIES =
  /node_modules\/(?:@reduxjs|d3-[a-z-]+|decimal\.js-light|es-toolkit|eventemitter3|immer|internmap|react-redux|redux|reselect)\//;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes("node_modules/recharts/")) return "recharts";
          if (CHART_DEPENDENCIES.test(id)) return "chart-vendor";
          return undefined;
        },
      },
    },
  },
});
