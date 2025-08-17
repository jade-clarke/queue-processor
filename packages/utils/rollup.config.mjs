import { builtinModules } from "node:module";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";

export default /** @type {import('rollup').RollupOptions} */ ({
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: true
  },
  external: (id) => builtinModules.includes(id) || id.startsWith("node:"),
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  },
  plugins: [
    resolve({ exportConditions: ["node", "import"], extensions: [".ts", ".js"] }),
    commonjs(),
    json(),
    esbuild({
      target: "node20",
      minify: false,
      sourcemap: true,
      legalComments: "none"
    })
  ]
});