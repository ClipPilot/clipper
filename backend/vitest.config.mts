import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: [
      "src/**/__tests__/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/worker/**",
        "src/archive/**",
        "src/types/**",
      ],
    },
    // Separate integration tests so they can be run independently
    typecheck: { enabled: false },
  },
  resolve: {
    alias: {
      "@clipper/shared-db/src/schema": path.resolve(
        __dirname,
        "../packages/shared-db/src/schema.ts"
      ),
      "@clipper/shared-db": path.resolve(
        __dirname,
        "../packages/shared-db/src/index.ts"
      ),
      "@clipper/shared-ui/utils/alertSeverity": path.resolve(
        __dirname,
        "../packages/shared-ui/src/utils/alertSeverity.ts"
      ),
      "@clipper/shared-ui": path.resolve(
        __dirname,
        "../packages/shared-ui/src/index.ts"
      ),
    },
  },
});
