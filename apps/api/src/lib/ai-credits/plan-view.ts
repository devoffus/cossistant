import type { PlanInfo } from "@api/lib/plans/access";
import type { AiCreditMeterState } from "./polar-meter";

export function resolveAiCreditsView(params: {
	planInfo: PlanInfo;
	meterState: AiCreditMeterState;
}) {
	const fallbackCredits =
		typeof params.planInfo.features["ai-credit"] === "number"
			? params.planInfo.features["ai-credit"]
			: null;

	if (params.meterState.meterBacked) {
		return {
			balance: params.meterState.balance,
			consumedUnits: params.meterState.consumedUnits,
			creditedUnits: params.meterState.creditedUnits,
			meterBacked: true,
			source: params.meterState.source,
			lastSyncedAt: params.meterState.lastSyncedAt,
		};
	}

	return {
		balance: fallbackCredits,
		consumedUnits: null,
		creditedUnits: fallbackCredits,
		meterBacked: false,
		source: fallbackCredits === null ? "unavailable" : "plan_fallback",
		lastSyncedAt: params.meterState.lastSyncedAt,
	};
}
