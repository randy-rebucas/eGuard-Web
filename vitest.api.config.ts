import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// API tests. HTTP tests need a running server: API_BASE_URL (default http://localhost:3000).
// Service tests (billing) import server modules directly and use the database from .env.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/api/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
