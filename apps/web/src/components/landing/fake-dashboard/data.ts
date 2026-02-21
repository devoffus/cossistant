import type { RouterOutputs } from "@api/trpc/types";
import type { ConversationHeader } from "@cossistant/types";
import { ConversationStatus } from "@cossistant/types";

export type FakeVisitor = NonNullable<
	RouterOutputs["conversation"]["getVisitorById"]
>;

export type FakeTypingActor = {
	conversationId: string;
	actorType: "visitor" | "ai_agent";
	actorId: string;
	preview: string | null;
};

// Kept for fake-support-widget compatibility.
export type FakeTypingVisitor = {
	conversationId: string;
	visitorId: string;
	preview: string | null;
};

const ORGANIZATION_ID = "01JGORG11111111111111111";
const WEBSITE_ID = "01JGWEB11111111111111111";
const ANTHONY_RIERA_ID = "01JGUSER1111111111111111";
export const MARC_CONVERSATION_ID = "01JGAA2222222222222222222";
export const MARC_VISITOR_ID = "01JGVIS22222222222222222";

export const fakeAIAgent = {
	id: "01JGAIA11111111111111111",
	name: "Cossistant AI",
	image: null,
} as const;

const now = Date.now();

const msAgo = (ms: number) => new Date(now - ms).toISOString();
const minutesAgo = (minutes: number) => msAgo(minutes * 60 * 1000);
const hoursAgo = (hours: number) => msAgo(hours * 60 * 60 * 1000);
const daysAgo = (days: number) => msAgo(days * 24 * 60 * 60 * 1000);

const createFakeVisitor = (partial: {
	id: string;
	lastSeenAt: string;
	contact?: {
		id: string;
		name: string | null;
		email: string | null;
		image: string | null;
	};
	browser?: string;
	browserVersion?: string;
	os?: string;
	osVersion?: string;
	device?: string;
	deviceType?: string;
	country?: string;
	countryCode?: string;
	city?: string;
	region?: string;
	timezone?: string;
	language?: string;
	ip?: string;
	viewport?: string;
}): FakeVisitor =>
	({
		id: partial.id,
		browser: partial.browser ?? null,
		browserVersion: partial.browserVersion ?? null,
		os: partial.os ?? null,
		osVersion: partial.osVersion ?? null,
		device: partial.device ?? null,
		deviceType: partial.deviceType ?? null,
		ip: partial.ip ?? null,
		city: partial.city ?? null,
		region: partial.region ?? null,
		country: partial.country ?? null,
		countryCode: partial.countryCode ?? null,
		latitude: null,
		longitude: null,
		language: partial.language ?? null,
		timezone: partial.timezone ?? null,
		screenResolution: null,
		viewport: partial.viewport ?? null,
		createdAt: daysAgo(30),
		updatedAt: new Date(now).toISOString(),
		lastSeenAt: partial.lastSeenAt,
		websiteId: WEBSITE_ID,
		organizationId: ORGANIZATION_ID,
		blockedAt: null,
		blockedByUserId: null,
		isBlocked: false,
		contact: partial.contact ?? null,
		userId: null,
		isTest: false,
		deletedAt: null,
	}) as FakeVisitor;

const createMessageTimelineItem = (params: {
	id: string;
	conversationId: string;
	text: string;
	createdAt: string;
	visitorId?: string | null;
	userId?: string | null;
	aiAgentId?: string | null;
}) => ({
	id: params.id,
	conversationId: params.conversationId,
	organizationId: ORGANIZATION_ID,
	visibility: "public" as const,
	type: "message" as const,
	text: params.text,
	parts: [{ type: "text" as const, text: params.text }],
	userId: params.userId ?? null,
	visitorId: params.visitorId ?? null,
	aiAgentId: params.aiAgentId ?? null,
	createdAt: params.createdAt,
	deletedAt: null,
});

const createConversation = (params: {
	id: string;
	visitor: FakeVisitor;
	title: string;
	status?: ConversationHeader["status"];
	priority?: ConversationHeader["priority"];
	startedAt: string;
	updatedAt?: string;
	lastSeenAt?: string | null;
	lastTimelineItem: ConversationHeader["lastTimelineItem"];
	escalatedAt?: string | null;
	escalationHandledAt?: string | null;
	resolvedAt?: string | null;
	resolvedByUserId?: string | null;
	resolvedByAiAgentId?: string | null;
}): ConversationHeader => {
	const updatedAt =
		params.updatedAt ?? params.lastTimelineItem?.createdAt ?? params.startedAt;
	const resolvedAt = params.resolvedAt ?? null;

	return {
		id: params.id,
		status: params.status ?? ConversationStatus.OPEN,
		priority: params.priority ?? "normal",
		organizationId: ORGANIZATION_ID,
		visitorId: params.visitor.id,
		visitor: params.visitor as ConversationHeader["visitor"],
		websiteId: WEBSITE_ID,
		channel: "widget",
		title: params.title,
		resolutionTime:
			resolvedAt && params.lastTimelineItem
				? Math.max(
						0,
						Date.parse(resolvedAt) -
							Date.parse(params.lastTimelineItem.createdAt)
					)
				: null,
		startedAt: params.startedAt,
		firstResponseAt: null,
		resolvedAt,
		resolvedByUserId: params.resolvedByUserId ?? null,
		resolvedByAiAgentId: params.resolvedByAiAgentId ?? null,
		escalatedAt: params.escalatedAt ?? null,
		escalatedByAiAgentId: params.escalatedAt ? fakeAIAgent.id : null,
		escalationReason: params.escalatedAt
			? "Billing migration requires manual review"
			: null,
		escalationHandledAt: params.escalationHandledAt ?? null,
		escalationHandledByUserId: null,
		aiPausedUntil: null,
		createdAt: params.startedAt,
		updatedAt,
		deletedAt: null,
		lastMessageAt: params.lastTimelineItem?.createdAt ?? params.startedAt,
		lastSeenAt: params.lastSeenAt ?? null,
		visitorRating: null,
		visitorRatingAt: null,
		lastMessageTimelineItem: params.lastTimelineItem,
		lastTimelineItem: params.lastTimelineItem,
		viewIds: [],
		seenData: [],
	};
};

const pieterVisitor = createFakeVisitor({
	id: "01JGVIS11111111111111111",
	lastSeenAt: minutesAgo(35),
	contact: {
		id: "01JGCON11111111111111111",
		name: "Pieter Levels",
		email: "pieter@nomadlist.com",
		image: null,
	},
	browser: "Chrome",
	browserVersion: "121.0",
	os: "macOS",
	osVersion: "14.3",
	device: "MacBook Pro",
	deviceType: "desktop",
	country: "Thailand",
	countryCode: "TH",
	city: "Chiang Mai",
	region: "Chiang Mai Province",
	timezone: "Asia/Bangkok",
	language: "en-US",
	ip: "123.45.67.89",
	viewport: "1920x1080",
});

const nicoVisitor = createFakeVisitor({
	id: "01JGVIS44444444444444444",
	lastSeenAt: minutesAgo(3),
	contact: {
		id: "01JGCON44444444444444444",
		name: "Nico Jeannen",
		email: "nico@indie.page",
		image: null,
	},
	browser: "Firefox",
	browserVersion: "121.0",
	os: "Windows",
	osVersion: "11",
	device: "Desktop PC",
	deviceType: "desktop",
	country: "France",
	countryCode: "FR",
	city: "Paris",
	region: "Ile-de-France",
	timezone: "Europe/Paris",
	language: "fr-FR",
	ip: "185.23.45.67",
	viewport: "2560x1440",
});

const dannyVisitor = createFakeVisitor({
	id: "01JGVIS55555555555555555",
	lastSeenAt: minutesAgo(12),
	contact: {
		id: "01JGCON55555555555555555",
		name: "Danny Postma",
		email: "danny@landingfolio.com",
		image: null,
	},
	browser: "Safari",
	browserVersion: "17.2",
	os: "macOS",
	osVersion: "14.4",
	device: "MacBook Air",
	deviceType: "desktop",
	country: "Netherlands",
	countryCode: "NL",
	city: "Amsterdam",
	region: "North Holland",
	timezone: "Europe/Amsterdam",
	language: "nl-NL",
	ip: "84.124.78.90",
	viewport: "1728x1117",
});

const tonyVisitor = createFakeVisitor({
	id: "01JGVIS33333333333333333",
	lastSeenAt: hoursAgo(18),
	contact: {
		id: "01JGCON33333333333333333",
		name: "Tony Dinh",
		email: "tony@blackmagic.so",
		image: null,
	},
	browser: "Chrome",
	browserVersion: "121.0",
	os: "macOS",
	osVersion: "14.2",
	device: "MacBook Pro",
	deviceType: "desktop",
	country: "Vietnam",
	countryCode: "VN",
	city: "Ho Chi Minh City",
	region: "Ho Chi Minh",
	timezone: "Asia/Ho_Chi_Minh",
	language: "en-US",
	ip: "98.76.54.32",
	viewport: "1440x900",
});

export const marcVisitor: FakeVisitor = createFakeVisitor({
	id: MARC_VISITOR_ID,
	lastSeenAt: new Date(now).toISOString(),
	contact: {
		id: "01JGCON22222222222222222",
		name: "Marc Louvion",
		email: "marc@shipfa.st",
		image: null,
	},
	browser: "Chrome",
	browserVersion: "120.0",
	os: "macOS",
	osVersion: "14.2",
	device: "MacBook Pro",
	deviceType: "desktop",
	country: "France",
	countryCode: "FR",
	city: "Paris",
	region: "Ile-de-France",
	timezone: "Europe/Paris",
	language: "fr-FR",
	ip: "185.67.89.12",
	viewport: "1680x1050",
});

const waitingConversationId = "01JGAA1111111111111111111";
const needsHumanConversationId = "01JGAA4444444444444444444";
const otherConversationId = "01JGAA5555555555555555555";
const resolvedConversationId = "01JGAA3333333333333333333";

export const fakeConversations: ConversationHeader[] = [
	createConversation({
		id: needsHumanConversationId,
		visitor: nicoVisitor,
		title: "Payment completed but still on free tier",
		priority: "urgent",
		status: ConversationStatus.OPEN,
		startedAt: hoursAgo(10),
		updatedAt: hoursAgo(1),
		escalatedAt: hoursAgo(1),
		lastTimelineItem: createMessageTimelineItem({
			id: "01JGTIM44444444444444444",
			conversationId: needsHumanConversationId,
			text: "I paid for annual but my dashboard still shows free. Can someone fix this today?",
			visitorId: nicoVisitor.id,
			createdAt: hoursAgo(2),
		}),
	}),
	createConversation({
		id: waitingConversationId,
		visitor: pieterVisitor,
		title: "Annual plan invoice copy",
		priority: "high",
		status: ConversationStatus.OPEN,
		startedAt: hoursAgo(14),
		updatedAt: hoursAgo(13),
		lastTimelineItem: createMessageTimelineItem({
			id: "01JGTIM11111111111111111",
			conversationId: waitingConversationId,
			text: "Could you send me the VAT invoice PDF for last month?",
			visitorId: pieterVisitor.id,
			createdAt: hoursAgo(13),
		}),
	}),
	createConversation({
		id: otherConversationId,
		visitor: dannyVisitor,
		title: "Dark mode rollout timeline",
		priority: "normal",
		status: ConversationStatus.OPEN,
		startedAt: hoursAgo(3),
		updatedAt: minutesAgo(24),
		lastSeenAt: minutesAgo(10),
		lastTimelineItem: createMessageTimelineItem({
			id: "01JGTIM55555555555555555",
			conversationId: otherConversationId,
			text: "We just enabled dark mode for all projects. Want me to share the changelog?",
			aiAgentId: fakeAIAgent.id,
			createdAt: minutesAgo(24),
		}),
	}),
	createConversation({
		id: resolvedConversationId,
		visitor: tonyVisitor,
		title: "React integration docs",
		priority: "low",
		status: ConversationStatus.RESOLVED,
		startedAt: daysAgo(2),
		updatedAt: daysAgo(2),
		resolvedAt: daysAgo(2),
		resolvedByUserId: ANTHONY_RIERA_ID,
		lastTimelineItem: createMessageTimelineItem({
			id: "01JGTIM33333333333333333",
			conversationId: resolvedConversationId,
			text: "Got it working, thanks for the docs link!",
			visitorId: tonyVisitor.id,
			createdAt: daysAgo(2),
		}),
	}),
];

export const fakeVisitors: FakeVisitor[] = [
	pieterVisitor,
	nicoVisitor,
	dannyVisitor,
	tonyVisitor,
	marcVisitor,
];

export const createMarcConversation = (
	messageText: string,
	timestamp: Date
): ConversationHeader => {
	const createdAt = timestamp.toISOString();

	return createConversation({
		id: MARC_CONVERSATION_ID,
		visitor: marcVisitor,
		title: "Widget not loading on production",
		priority: "high",
		status: ConversationStatus.OPEN,
		startedAt: createdAt,
		updatedAt: createdAt,
		lastTimelineItem: createMessageTimelineItem({
			id: "01JGTIM22222222222222222",
			conversationId: MARC_CONVERSATION_ID,
			text: messageText,
			visitorId: MARC_VISITOR_ID,
			createdAt,
		}),
	});
};
