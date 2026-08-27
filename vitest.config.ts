import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["tests/browser/**", "**/node_modules/**", "**/dist/**"],
    setupFiles: "./packages/bi/src/test/setup.ts",
  },
});
