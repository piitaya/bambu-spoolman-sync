import { defineConfig } from "vitest/config";

// Utility-function tests only (node environment, no DOM) — React
// components are intentionally not tested here.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
