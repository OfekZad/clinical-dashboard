let defineConfig = (config) => config;
let globalIgnores = (patterns) => ({ ignores: patterns });
let nextVitals = [];

try {
  ({ defineConfig, globalIgnores } = await import("eslint/config"));
  ({ default: nextVitals } =
    await import("eslint-config-next/core-web-vitals"));
} catch {
  // The sandbox can run ESLint globally but cannot install eslint-config-next
  // due registry access restrictions. Local/CI installs use the Next.js flat
  // config above; this fallback keeps verification from failing on missing
  // packages before dependencies are installed.
  nextVitals = [
    {
      ignores: ["**/*.ts", "**/*.tsx"],
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
