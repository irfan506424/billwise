import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Tests share a single SQLite file (tests/test.db) recreated per file in
    // setup.ts, so files must run sequentially to avoid cross-file collisions.
    fileParallelism: false,
  },
});
