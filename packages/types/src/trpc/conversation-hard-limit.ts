export const DASHBOARD_CONVERSATION_LOCK_REASON = "conversation_limit" as const;

export type DashboardConversationLockReason =
	typeof DASHBOARD_CONVERSATION_LOCK_REASON;

export type ConversationHardLimitCutoff = {
	id: string;
	createdAt: string;
};

export type DashboardLockableConversation = {
	id: string;
	createdAt: string;
	title: string | null;
	lastTimelineItem: unknown | null;
	lastMessageTimelineItem: unknown | null;
	lastMessageAt: string | null;
	dashboardLocked?: boolean;
	dashboardLockReason?: DashboardConversationLockReason | null;
};

type DashboardLockMetadata = {
	dashboardLocked: boolean;
	dashboardLockReason: DashboardConversationLockReason | null;
};

export function isConversationAfterHardLimitCutoff(
	value: Pick<DashboardLockableConversation, "createdAt" | "id">,
	cutoff: ConversationHardLimitCutoff | null
): boolean {
	if (!cutoff) {
		return false;
	}

	if (value.createdAt > cutoff.createdAt) {
		return true;
	}

	if (value.createdAt < cutoff.createdAt) {
		return false;
	}

	return value.id > cutoff.id;
}

export function applyDashboardConversationHardLimitLock<
	T extends DashboardLockableConversation,
>(params: {
	conversation: T;
	cutoff: ConversationHardLimitCutoff | null;
}): T & DashboardLockMetadata {
	const { conversation, cutoff } = params;
	const isLocked = isConversationAfterHardLimitCutoff(conversation, cutoff);

	if (!isLocked) {
		return {
			...conversation,
			dashboardLocked: false,
			dashboardLockReason: null,
		};
	}

	return {
		...conversation,
		lastTimelineItem: null,
		lastMessageTimelineItem: null,
		lastMessageAt: null,
		dashboardLocked: true,
		dashboardLockReason: DASHBOARD_CONVERSATION_LOCK_REASON,
	};
}

export function ensureDashboardConversationLockRedaction<
	T extends DashboardLockableConversation,
>(conversation: T): T & DashboardLockMetadata {
	if (!conversation.dashboardLocked) {
		return {
			...conversation,
			dashboardLocked: false,
			dashboardLockReason: null,
		};
	}

	return {
		...conversation,
		lastTimelineItem: null,
		lastMessageTimelineItem: null,
		lastMessageAt: null,
		dashboardLocked: true,
		dashboardLockReason:
			conversation.dashboardLockReason ?? DASHBOARD_CONVERSATION_LOCK_REASON,
	};
}
