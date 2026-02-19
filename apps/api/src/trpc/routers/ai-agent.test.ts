import { describe, expect, it } from "bun:test";
import { getModelSelectionError } from "./ai-agent";

describe("ai-agent router model validation", () => {
	it("rejects unknown models", () => {
		const result = getModelSelectionError({
			modelId: "anthropic/claude-sonnet-4-20250514",
			latestModelsFeature: true,
		});

		expect(result?.code).toBe("BAD_REQUEST");
	});

	it("rejects latest-tier model when latest-ai-models feature is disabled", () => {
		const result = getModelSelectionError({
			modelId: "openai/gpt-5.2-chat",
			latestModelsFeature: false,
		});

		expect(result?.code).toBe("FORBIDDEN");
	});

	it("allows supported baseline models on lower tiers", () => {
		const result = getModelSelectionError({
			modelId: "moonshotai/kimi-k2-0905",
			latestModelsFeature: false,
		});

		expect(result).toBeNull();
	});
});
