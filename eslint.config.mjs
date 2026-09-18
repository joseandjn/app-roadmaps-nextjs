import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The engine must stay extractable into its own service: no web framework,
  // no app code (`@/`) and no reaching outside its own folder.
  {
    files: ["engine/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*"], message: "The engine must not depend on the web framework." },
          { group: ["@/*", "../../*", "../../../*"], message: "The engine must not import app code; keep it self-contained." },
        ],
      }],
    },
  },
]);

export default eslintConfig;
