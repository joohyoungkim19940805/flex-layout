import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  treeshake: true,

  //  React는 반드시 외부로
  external: ["react", "react-dom", "react/jsx-runtime", "rxjs"],
});