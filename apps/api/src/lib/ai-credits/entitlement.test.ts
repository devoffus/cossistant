import { describe, expect, it } from "bun:test";
import { canUseSelectedModelForPlan } from "./entitlement";

describe("model entitlement", () => {
	it("allows high-end model when latest model feature is enabled", () => {
		expect(
			canUseSelectedModelForPlan({
				modelId: "openai/gpt-5.2-chat",
				latestModelsFeature: true,
			})
		).toBe(true);
	});

	it("blocks high-end model when latest model feature is disabled", () => {
		expect(
			canUseSelectedModelForPlan({
				modelId: "openai/gpt-5.2-chat",
				latestModelsFeature: false,
			})
		).toBe(false);
	});

	it("allows low-tier model when latest model feature is disabled", () => {
		expect(
			canUseSelectedModelForPlan({
				modelId: "moonshotai/kimi-k2.5",
				latestModelsFeature: false,
			})
		).toBe(true);
	});

	it("rejects unknown model IDs", () => {
		expect(
			canUseSelectedModelForPlan({
				modelId: "anthropic/claude-sonnet-4-20250514",
				latestModelsFeature: true,
			})
		).toBe(false);
	});
});
