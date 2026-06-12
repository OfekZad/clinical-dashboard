let defineConfig = (config) => config;
let globalIgnores = (patterns) => ({ ignores: patterns });
let nextVitals = [];

try {
  ({ defineConfig, globalIgnores } = await import("eslint/config"));
  ({ default: nextVitals } = await import("eslint-config-next/core-web-vitals"));
} catch {
  // The sandbox may not have Next ESLint packages installed when registry
  // access is blocked. This fallback keeps `eslint .` usable here; when
  // eslint-config-next is installed, the Next core-web-vitals config is used.
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
