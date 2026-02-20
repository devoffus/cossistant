type TeamInviteAction =
	| "created"
	| "added_to_team"
	| "promoted"
	| "delivery_failed"
	| "resend_sent"
	| "resend_failed";

type TeamInviteEvent = {
	action: TeamInviteAction;
	organizationId: string;
	websiteId: string;
	teamId: string;
	email: string;
	invitationId?: string;
	role?: string;
	reason?: string;
	timestamp: Date;
};

type TeamInviteCounterName =
	| "invite_delivery_failed_total"
	| "invite_resend_attempt_total"
	| "invite_resend_success_total";

export function logTeamInviteEvent(event: TeamInviteEvent): void {
	const logData = {
		...event,
		timestamp: event.timestamp.toISOString(),
	};

	console.log(`[Team Invite Event] ${JSON.stringify(logData)}`);
}

export function incrementTeamInviteCounter(params: {
	counter: TeamInviteCounterName;
	organizationId: string;
	websiteId: string;
	teamId: string;
	value?: number;
}): void {
	console.log(
		`[Team Invite Counter] ${JSON.stringify({
			counter: params.counter,
			organizationId: params.organizationId,
			websiteId: params.websiteId,
			teamId: params.teamId,
			value: params.value ?? 1,
			timestamp: new Date().toISOString(),
		})}`
	);
}
