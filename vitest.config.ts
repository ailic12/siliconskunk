import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    // Integration tests share one real Postgres instance and some (migration
    // up/down, seed) mutate the same domain tables — running test files in
    // parallel is unsafe here, not just slow.
    fileParallelism: false,
  },
});
