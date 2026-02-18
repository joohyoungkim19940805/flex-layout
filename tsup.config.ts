import { preserveDirectivesPlugin } from "esbuild-plugin-preserve-directives";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	format: ["esm", "cjs"],
	clean: true,
	sourcemap: true,
	target: "es2020",

	bundle: false,
	splitting: false,
	treeshake: false,

	metafile: true,

	esbuildPlugins: [
		preserveDirectivesPlugin({
			directives: ["use client"],
			include: /\.(js|ts|jsx|tsx)$/,
			exclude: /node_modules/,
		}),
	],

	external: ["react", "react-dom", "react/jsx-runtime"],

	esbuildOptions(options) {
		options.jsx = "automatic";
		options.jsxImportSource = "react";

		options.outbase = "src";
		options.entryNames = "[dir]/[name]";
	},
});
