/**
 * Search Knowledge Base Tool
 *
 * Allows the AI to search the knowledge base for relevant articles and documentation.
 * Returns enriched results with source metadata for attribution.
 */

import { type ToolExecutionOptions, tool } from "ai";
import { z } from "zod";
import { generateULID } from "../../utils/db/ids";
import type { ChunkSearchResult } from "../../utils/vector-search";
import { findSimilarKnowledge } from "../../utils/vector-search";
import { emitToolProgress } from "../events/progress";
import type { ToolContext, ToolResult } from "./types";

export type KnowledgeResult = {
	content: string;
	similarity: number;
	/** Source title (article title, page title, FAQ question) */
	title: string | null;
	/** Source URL if available */
	sourceUrl: string | null;
	/** Type of knowledge source */
	sourceType: string | null;
};

type SearchResultData = {
	articles: KnowledgeResult[];
	query: string;
	/** Total results found */
	totalFound: number;
	/** Whether results are low confidence (all below 0.75) */
	lowConfidence: boolean;
	/** Guidance message for the LLM */
	guidance: string | null;
};

const inputSchema = z.object({
	query: z
		.string()
		.describe(
			"A short, specific search query (e.g., 'password reset process', 'pricing plans', 'refund policy'). Use keywords, not full sentences. If your first search returns nothing, try rephrasing with different terms."
		),
});

/**
 * Extract metadata fields from a chunk's metadata JSONB
 */
function extractMetadata(result: ChunkSearchResult): {
	title: string | null;
	sourceUrl: string | null;
	sourceType: string | null;
} {
	const meta = result.metadata as Record<string, unknown> | null;
	if (!meta) {
		return { title: null, sourceUrl: null, sourceType: null };
	}

	return {
		title: (meta.title as string) ?? (meta.question as string) ?? null,
		sourceUrl: (meta.url as string) ?? null,
		sourceType: (meta.sourceType as string) ?? null,
	};
}

/**
 * Deduplicate and group results by knowledge source.
 * Takes the highest-similarity chunk per knowledgeId, but merges
 * content from adjacent chunks for richer context.
 */
function deduplicateResults(results: ChunkSearchResult[]): ChunkSearchResult[] {
	const byKnowledge = new Map<string, ChunkSearchResult[]>();

	for (const result of results) {
		const key = result.knowledgeId ?? result.id;
		const existing = byKnowledge.get(key);
		if (existing) {
			existing.push(result);
		} else {
			byKnowledge.set(key, [result]);
		}
	}

	const deduplicated: ChunkSearchResult[] = [];

	for (const chunks of byKnowledge.values()) {
		// Sort by chunk index for merging adjacent content
		chunks.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

		// Take the highest similarity chunk as the primary
		const primary = chunks.reduce((best, current) =>
			current.similarity > best.similarity ? current : best
		);

		// Merge content from all chunks of the same source for richer context
		if (chunks.length > 1) {
			const mergedContent = chunks.map((c) => c.content).join("\n\n");
			deduplicated.push({
				...primary,
				content: mergedContent,
			});
		} else {
			deduplicated.push(primary);
		}
	}

	// Sort by similarity descending
	deduplicated.sort((a, b) => b.similarity - a.similarity);

	return deduplicated;
}

/**
 * Format results into clean context blocks the LLM can easily parse
 */
function formatResults(results: ChunkSearchResult[]): KnowledgeResult[] {
	return results.map((r) => {
		const meta = extractMetadata(r);
		return {
			content: r.content,
			similarity: Math.round(r.similarity * 100) / 100,
			title: meta.title,
			sourceUrl: meta.sourceUrl,
			sourceType: meta.sourceType,
		};
	});
}

/**
 * Create the searchKnowledgeBase tool with bound context
 */
export function createSearchKnowledgeBaseTool(ctx: ToolContext) {
	return tool({
		description:
			"Search indexed knowledge content using a short keyword query and return ranked evidence snippets.",
		inputSchema,
		execute: async (
			{ query },
			options?: ToolExecutionOptions
		): Promise<ToolResult<SearchResultData>> => {
			const toolCallId = options?.toolCallId ?? generateULID();

			try {
				console.log(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | query="${query}"`
				);

				// Emit progress: searching
				if (ctx.workflowRunId) {
					await emitToolProgress({
						conversation: ctx.conversation,
						aiAgentId: ctx.aiAgentId,
						workflowRunId: ctx.workflowRunId,
						toolCallId,
						toolName: "searchKnowledgeBase",
						state: "partial",
						progressMessage: "Searching knowledge base...",
					}).catch((err) =>
						console.warn(
							"[tool:searchKnowledgeBase] Failed to emit progress:",
							err
						)
					);
				}

				const results = await findSimilarKnowledge(
					ctx.db,
					query,
					ctx.websiteId,
					{
						limit: 5,
						minSimilarity: 0.3,
					}
				);

				// Deduplicate results from the same knowledge source
				const deduplicated = deduplicateResults(results);
				const articles = formatResults(deduplicated);
				const totalFound = articles.length;

				console.log(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | found=${totalFound} articles (${results.length} raw chunks)`
				);

				// Emit progress: complete
				if (ctx.workflowRunId) {
					await emitToolProgress({
						conversation: ctx.conversation,
						aiAgentId: ctx.aiAgentId,
						workflowRunId: ctx.workflowRunId,
						toolCallId,
						toolName: "searchKnowledgeBase",
						state: "result",
						progressMessage:
							totalFound > 0
								? `Found ${totalFound} relevant source${totalFound > 1 ? "s" : ""}`
								: "No results found",
					}).catch((err) =>
						console.warn(
							"[tool:searchKnowledgeBase] Failed to emit progress:",
							err
						)
					);
				}

				// Determine confidence and guidance
				const lowConfidence =
					totalFound > 0 && articles.every((a) => a.similarity < 0.75);

				let guidance: string | null = null;
				if (totalFound === 0) {
					guidance =
						"No relevant knowledge found for this query. Do NOT make up information. You can try rephrasing with different keywords. If still no results, tell the visitor you don't have that information and offer to escalate to a team member.";
				} else if (lowConfidence) {
					guidance =
						"Results have low confidence. Use them as hints but qualify your answer (e.g., 'Based on what I found...'). If the information seems insufficient, offer to connect the visitor with the team.";
				}

				return {
					success: true,
					data: {
						articles,
						query,
						totalFound,
						lowConfidence,
						guidance,
					},
				};
			} catch (error) {
				console.error(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | Failed:`,
					error
				);

				// Emit progress: error
				if (ctx.workflowRunId) {
					await emitToolProgress({
						conversation: ctx.conversation,
						aiAgentId: ctx.aiAgentId,
						workflowRunId: ctx.workflowRunId,
						toolCallId,
						toolName: "searchKnowledgeBase",
						state: "error",
						progressMessage: "Search failed",
					}).catch(() => {});
				}

				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: "Failed to search knowledge base",
				};
			}
		},
	});
}
