/**
 * Vitest configuration for Kibo-track unit and convention tests.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
