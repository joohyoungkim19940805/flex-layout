import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		components: "src/flex-layout/components/index.ts",
		hooks: "src/flex-layout/hooks/index.ts",
		utils: "src/flex-layout/utils/index.ts",
		store: "src/flex-layout/store/index.ts",
		providers: "src/flex-layout/providers/index.ts",
	},
	format: ["esm", "cjs"],
	dts: false,
	sourcemap: true,
	clean: true,
	treeshake: true,
	splitting: false,

	//  React는 반드시 외부로
	external: ["react", "react-dom", "react/jsx-runtime", "rxjs"],
});
