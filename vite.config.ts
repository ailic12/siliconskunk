import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the TASK-17 React SPA (frontend/) into public/, the same directory
// demo-ui.routes.ts already serves from — replacing TASK-15's single static
// index.html with a real build output, same serving contract (same-origin,
// no new auth surface).
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
