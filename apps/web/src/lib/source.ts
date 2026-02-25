import {
	blog as blogPosts,
	changelog as changelogPosts,
	docs,
} from "fumadocs-mdx:collections/server";
import {
	source as createSource,
	loader,
	type MetaData,
	type PageData,
} from "fumadocs-core/source";

// TODO: Uncomment when OpenAPI docs are needed (requires fumadocs-openapi v10 migration)
// import { openapiPlugin, openapiSource } from "fumadocs-openapi/server";
// import { openapi } from "@/lib/openapi";

type CollectionInfo = {
	info: {
		path: string;
		fullPath: string;
	};
};

function createCollectionSource<
	Page extends PageData & CollectionInfo,
	Meta extends MetaData & CollectionInfo,
>(pages: Page[], metas: Meta[]) {
	return createSource({
		pages: pages.map((page) => ({
			type: "page",
			path: page.info.path,
			absolutePath: page.info.fullPath,
			data: page,
		})),
		metas: metas.map((meta) => ({
			type: "meta",
			path: meta.info.path,
			absolutePath: meta.info.fullPath,
			data: meta,
		})),
	});
}

export const source = loader(createCollectionSource(docs.docs, docs.meta), {
	baseUrl: "/docs",
	// TODO: Uncomment when OpenAPI docs are needed
	// plugins: [openapiPlugin()],
});

// Original OpenAPI-enabled source config:
// export const source = loader(
// 	multiple({
// 		docs: docs.toFumadocsSource(),
// 		openapi: await openapiSource(openapi, {
// 			baseDir: "openapi/(generated)",
// 		}),
// 	}),
// 	{
// 		baseUrl: "/docs",
// 		plugins: [openapiPlugin()],
// 	}
// );

export const blog = loader(createCollectionSource(blogPosts, [] as never[]), {
	baseUrl: "/blog",
});

export const changelog = loader(
	createCollectionSource(changelogPosts, [] as never[]),
	{
		baseUrl: "/changelog",
	}
);
