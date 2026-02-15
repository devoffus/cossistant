import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/**/*.ts",
		"src/**/*.tsx",
		"!src/**/*.test.ts",
		"!src/**/*.test.tsx",
		"!src/**/*.stories.tsx",
		"!src/**/*.css",
	],
	clean: true,
	dts: true,
	hash: false,
	minify: true,
	sourcemap: false,
	treeshake: true,
	unbundle: true,
	outExtensions: () => ({
		js: ".js",
		dts: ".d.ts",
	}),
	external: [
		"@cossistant/react",
		"@cossistant/core",
		"@cossistant/types",
		"next",
		"react",
		"react-dom",
		"react/jsx-runtime",
	],
});
