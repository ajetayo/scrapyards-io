import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx"],
    environment: "node",
  },
});
