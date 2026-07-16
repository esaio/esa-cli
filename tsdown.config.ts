import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "bin",
  format: "esm",
  platform: "node",
  target: "node24",
  clean: true,
  dts: false,
  tsconfig: "tsconfig.build.json",
  minify: false,
  fixedExtension: false,
});
