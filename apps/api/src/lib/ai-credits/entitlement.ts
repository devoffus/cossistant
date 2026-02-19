import { isModelAllowedForPlan } from "./config";

export function canUseSelectedModelForPlan(params: {
	modelId: string;
	latestModelsFeature: unknown;
}): boolean {
	return isModelAllowedForPlan({
		modelId: params.modelId,
		latestModelsFeature: params.latestModelsFeature,
	});
}
