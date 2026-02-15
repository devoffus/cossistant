// biome-ignore lint/nursery/useConsistentTypeDefinitions: interface required for global type augmentation (declaration merging)
interface ImportMetaEnv {
	readonly VITE_COSSISTANT_API_KEY?: string;
	readonly MODE?: string;
	[key: string]: string | undefined;
}

// biome-ignore lint/nursery/useConsistentTypeDefinitions: interface required for global type augmentation (declaration merging)
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
