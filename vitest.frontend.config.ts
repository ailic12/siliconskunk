import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Isolated from vitest.config.ts on purpose: backend integration tests run
// with fileParallelism disabled because they share one real Postgres
// instance (see that file's own comment). Frontend component tests touch no
// database and run under jsdom, not Node — forcing them through the same
// config would needlessly serialize them and would require jsdom globals
// the backend suite has no reason to load.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["frontend/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./frontend/src/test-setup.ts"],
  },
});
