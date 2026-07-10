import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
  },
  plugins: [WxtVitest()]
});