"use client";

import type { RouterOutputs } from "@cossistant/api/types";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "./upgrade-modal";

type PlanInfo = RouterOutputs["plan"]["getPlanInfo"];

function getUsagePercentage(limit: number | null, used: number): number {
	if (limit === null || limit <= 0) {
		return 0;
	}

	return Math.min(100, Math.round((used / limit) * 100));
}

type HardLimitRowProps = {
	label: string;
	used: number;
	limit: number | null;
	reached: boolean;
	enforced: boolean;
};

function HardLimitRow({
	label,
	used,
	limit,
	reached,
	enforced,
}: HardLimitRowProps) {
	const percentage = getUsagePercentage(limit, used);
	const barWidth = percentage === 0 ? 0 : Math.max(percentage, 2);

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between text-xs">
				<span className="font-medium text-primary/80">{label}</span>
				<span
					className={cn("text-primary/50", reached && "text-cossistant-orange")}
				>
					{limit === null
						? `${used.toLocaleString()} / Unlimited`
						: `${used.toLocaleString()} / ${limit.toLocaleString()}`}
				</span>
			</div>
			{limit !== null ? (
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-background-200 dark:bg-background-800">
					<div
						className={cn(
							"h-full rounded-r-full transition-all",
							reached ? "bg-cossistant-orange" : "bg-cossistant-blue"
						)}
						style={{ width: `${barWidth}%` }}
					/>
				</div>
			) : null}
			{reached ? (
				<div className="text-[11px] text-cossistant-orange">
					{enforced
						? "Limit reached"
						: "Limit reached (temporarily not enforced)"}
				</div>
			) : null}
		</div>
	);
}

type SidebarUpgradeButtonProps = {
	websiteSlug: string;
	planInfo: PlanInfo;
};

export function SidebarUpgradeButton({
	websiteSlug,
	planInfo,
}: SidebarUpgradeButtonProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const { plan, hardLimitStatus } = planInfo;

	const highlightedFeatureKey = useMemo(() => {
		if (hardLimitStatus.conversations.reached) {
			return "conversations" as const;
		}

		return "messages" as const;
	}, [hardLimitStatus.conversations.reached]);

	if (plan.name !== "free") {
		return null;
	}

	return (
		<>
			<button
				className="relative flex h-auto w-full flex-col gap-3 overflow-hidden rounded-[2px] border border-cossistant-orange/60 border-dashed bg-background-100 p-4 text-left hover:bg-background-200 dark:border-cossistant-orange/20"
				onClick={() => setIsModalOpen(true)}
				type="button"
			>
				<div className="font-medium text-base text-cossistant-orange">
					Upgrade to Pro
				</div>

				{!hardLimitStatus.enforced && (
					<div className="rounded border border-cossistant-orange/30 bg-cossistant-orange/5 px-2 py-1 text-[11px] text-cossistant-orange">
						Hard-limit checks are temporarily unavailable while billing sync
						recovers.
					</div>
				)}

				<div className="space-y-3">
					<HardLimitRow
						enforced={hardLimitStatus.enforced}
						label="Messages"
						limit={hardLimitStatus.messages.limit}
						reached={hardLimitStatus.messages.reached}
						used={hardLimitStatus.messages.used}
					/>
					<HardLimitRow
						enforced={hardLimitStatus.enforced}
						label="Conversations"
						limit={hardLimitStatus.conversations.limit}
						reached={hardLimitStatus.conversations.reached}
						used={hardLimitStatus.conversations.used}
					/>
				</div>

				<div className="text-[11px] text-primary/40">
					Rolling {hardLimitStatus.rollingWindowDays}-day window
				</div>
			</button>

			<UpgradeModal
				currentPlan={plan}
				highlightedFeatureKey={highlightedFeatureKey}
				initialPlanName="pro"
				onOpenChange={setIsModalOpen}
				open={isModalOpen}
				websiteSlug={websiteSlug}
			/>
		</>
	);
}
