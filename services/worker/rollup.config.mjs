import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";
import esbuild from "rollup-plugin-esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

export default /** @type {import('rollup').RollupOptions} */ ({
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  external: (id) => builtinModules.includes(id) || id.startsWith("node:"),
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
  },
  plugins: [
    alias({
      entries: [
        {
          find: "@utils",
          replacement: path.join(repoRoot, "packages/utils/src"),
        },
      ],
    }),
    resolve({
      exportConditions: ["node", "import"],
      preferBuiltins: true,
      extensions: [".ts", ".tsx", ".mjs", ".js", ".json"],
    }),
    commonjs(),
    json(),
    esbuild({
      target: "node20",
      tsconfig: path.join(repoRoot, "tsconfig.base.json"),
      minify: true,
      sourcemap: true,
      legalComments: "none",
    }),
  ],
  onwarn(warning, warn) {
    if (
      warning.code === "CIRCULAR_DEPENDENCY" &&
      /iovalkey/.test(
        String(warning.importer || "") + String(warning.ids || "")
      )
    )
      return;
    warn(warning);
  },
});
