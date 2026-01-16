/**
 * Configures Vitest to resolve Remix's `~` alias (which maps to `/app`)
 * and sets up the test environment for unit testing server-side logic.
 * 
 * Without this, imports like `~/utils/...` would fail in tests because
 * Vitest/Vite doesn't know about Remix's path aliases by default.
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
    },
  },
});
