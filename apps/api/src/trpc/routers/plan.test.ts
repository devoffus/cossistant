import { describe, expect, it } from "bun:test";
import { buildAiModelsForPlanInfo } from "./plan";

describe("plan router aiModels view", () => {
	it("marks premium models as locked without latest-ai-models entitlement", () => {
		const view = buildAiModelsForPlanInfo({
			latestModelsFeature: false,
		});

		expect(view.defaultModelId).toBe("moonshotai/kimi-k2-0905");
		expect(
			view.items.find((model) => model.id === "openai/gpt-5.2-chat")
				?.selectableForCurrentPlan
		).toBe(false);
		expect(
			view.items.find((model) => model.id === "moonshotai/kimi-k2.5")
				?.selectableForCurrentPlan
		).toBe(true);
	});

	it("unlocks premium models when latest-ai-models entitlement is enabled", () => {
		const view = buildAiModelsForPlanInfo({
			latestModelsFeature: true,
		});

		expect(
			view.items.find((model) => model.id === "openai/gpt-5.2-chat")
				?.selectableForCurrentPlan
		).toBe(true);
	});
});
