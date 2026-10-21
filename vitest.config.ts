import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
  },
  plugins: [WxtVitest()]
});