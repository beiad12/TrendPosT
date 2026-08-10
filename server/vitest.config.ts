import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setupEnv.ts"],
    // 4K-scale render tests are legitimately CPU-heavy (real image compositing,
    // not a hang) and can exceed vitest's 5s default under load when the full
    // suite runs concurrently.
    testTimeout: 20_000,
  },
});
