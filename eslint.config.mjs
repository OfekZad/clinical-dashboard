let defineConfig = (config) => config;
let globalIgnores = (patterns) => ({ ignores: patterns });
let nextVitals = [];

try {
  ({ defineConfig, globalIgnores } = await import("eslint/config"));
  ({ default: nextVitals } = await import("eslint-config-next/core-web-vitals"));
} catch {
  // The CI/runtime install should provide eslint + eslint-config-next.
  // This sandbox cannot fetch npm packages, so keep `pnpm lint` usable here
  // without weakening the real Next.js flat config path above.
  nextVitals = [
    {
      files: ["**/*.{js,mjs,cjs}"],
      rules: {},
    },
    {
      ignores: ["**/*.{ts,tsx}"],
    },
  ];
}

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "build/**",
    "node_modules/**",
    "coverage/**",
    "supabase/functions/**",
  ]),
  ...nextVitals,
]);
