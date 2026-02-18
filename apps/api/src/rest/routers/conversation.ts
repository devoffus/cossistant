import { markConversationAsSeenByVisitor } from "@api/db/mutations/conversation";
import { getVisitor } from "@api/db/queries";
import {
	getConversationByIdWithLastMessage,
	getConversationHeader,
	getConversationSeenData,
	getConversationTimelineItems,
	listConversations,
	upsertConversation,
} from "@api/db/queries/conversation";
import { createFeedback } from "@api/db/queries/feedback";
import {
	conversation,
	type conversationTimelineItem,
} from "@api/db/schema/conversation";
import {
	applyDashboardConversationHardLimit,
	getDashboardConversationLockCutoff,
	resolveDashboardHardLimitPolicy,
} from "@api/lib/hard-limits/dashboard";
import { getPlanForWebsite } from "@api/lib/plans/access";
import { trackConversationMetric } from "@api/lib/tinybird-sdk";
import { markVisitorPresence } from "@api/services/presence";
import {
	emitConversationCreatedEvent,
	emitConversationSeenEvent,
	emitConversationTypingEvent,
} from "@api/utils/conversation-realtime";
import { extractGeoFromVisitor } from "@api/utils/geo-helpers";
import {
	addConversationParticipants,
	getDefaultParticipants,
} from "@api/utils/participant-helpers";
import { triggerMessageNotificationWorkflow } from "@api/utils/send-message-with-notification";
import {
	createMessageTimelineItem,
	createTimelineItem,
} from "@api/utils/timeline-item";
import {
	safelyExtractRequestData,
	safelyExtractRequestQuery,
	validateResponse,
} from "@api/utils/validate";
import { APIKeyType, TimelineItemVisibility } from "@cossistant/types";
import {
	createConversationRequestSchema,
	createConversationResponseSchema,
	getConversationRequestSchema,
	getConversationResponseSchema,
	listConversationsRequestSchema,
	listConversationsResponseSchema,
	markConversationSeenRequestSchema,
	markConversationSeenResponseSchema,
	setConversationTypingRequestSchema,
	setConversationTypingResponseSchema,
	submitConversationRatingRequestSchema,
	submitConversationRatingResponseSchema,
} from "@cossistant/types/api/conversation";
import {
	getConversationTimelineItemsRequestSchema,
	getConversationTimelineItemsResponseSchema,
	type TimelineItem,
	timelineItemSchema,
} from "@cossistant/types/api/timeline-item";
import {
	conversationSchema,
	conversationSeenSchema,
} from "@cossistant/types/schemas";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { protectedPublicApiKeyMiddleware } from "../middleware";
import type { RestContext } from "../types";

type ConversationRow = typeof conversation.$inferSelect;
type ConversationTimelineItemRow = typeof conversationTimelineItem.$inferSelect;

const serializeTimelineItemForResponse = (
	item: (ConversationTimelineItemRow & { parts: unknown }) | TimelineItem
) =>
	timelineItemSchema.parse({
		id: item.id,
		conversationId: item.conversationId,
		organizationId: item.organizationId,
		visibility: item.visibility,
		type: item.type,
		text: "text" in item ? (item.text ?? null) : null,
		parts: Array.isArray(item.parts) ? item.parts : (item.parts as unknown[]),
		userId: "userId" in item ? (item.userId ?? null) : null,
		aiAgentId: "aiAgentId" in item ? (item.aiAgentId ?? null) : null,
		visitorId: "visitorId" in item ? (item.visitorId ?? null) : null,
		createdAt: item.createdAt,
		deletedAt: "deletedAt" in item ? (item.deletedAt ?? null) : null,
	});

const serializeConversationForResponse = (
	record: ConversationRow & {
		lastTimelineItem?:
			| (ConversationTimelineItemRow & { parts: unknown })
			| TimelineItem
			| undefined;
		visitorLastSeenAt?: string | null;
	}
) => {
	const serializedConversation = conversationSchema.parse({
		id: record.id,
		title: record.title ?? undefined,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		visitorId: record.visitorId,
		websiteId: record.websiteId,
		status: record.status,
		visitorRating: record.visitorRating ?? null,
		visitorRatingAt: record.visitorRatingAt ?? null,
		deletedAt: record.deletedAt ?? null,
		lastTimelineItem: record.lastTimelineItem
			? serializeTimelineItemForResponse(record.lastTimelineItem)
			: undefined,
	});

	return {
		...serializedConversation,
		visitorLastSeenAt: record.visitorLastSeenAt ?? null,
	};
};

export const conversationRouter = new OpenAPIHono<RestContext>();

// Apply middleware to all routes in this router
conversationRouter.use("/*", ...protectedPublicApiKeyMiddleware);

conversationRouter.openapi(
	{
		method: "post",
		path: "/",
		summary: "Create a conversation (optionally with initial timeline items)",
		description:
			"Create a conversation; optionally pass a conversationId and a set of default timeline items.",
		tags: ["Conversations"],
		request: {
			body: {
				required: true,
				content: {
					"application/json": {
						schema: createConversationRequestSchema,
					},
				},
			},
		},
		responses: {
			200: {
				description: "Conversation created",
				content: {
					"application/json": {
						schema: createConversationResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
			{
				"Private API Key": [],
			},
		],
		parameters: [
			{
				name: "Authorization",
				in: "header",
				description:
					"Private API key in Bearer token format. Use this for server-to-server authentication. Format: `Bearer sk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^Bearer sk_(live|test)_[a-f0-9]{64}$",
					example: "Bearer sk_test_xxx",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
					example: "pk_test_xxx",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
					example: "01JG000000000000000000000",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, body, visitorIdHeader } =
			await safelyExtractRequestData(c, createConversationRequestSchema);

		const visitor = await getVisitor(db, {
			visitorId: body.visitorId || visitorIdHeader,
		});

		if (!visitor) {
			return c.json(
				{
					error: "Visitor not found, please pass a valid visitorId",
				},
				400
			);
		}

		const conversationRecord = await upsertConversation(db, {
			organizationId: organization.id,
			websiteId: website.id,
			visitorId: visitor.id,
			conversationId: body.conversationId,
		});

		// Add default participants if configured
		const defaultParticipantIds = await getDefaultParticipants(db, website);
		if (defaultParticipantIds.length > 0) {
			await addConversationParticipants(db, {
				conversationId: conversationRecord.id,
				userIds: defaultParticipantIds,
				organizationId: organization.id,
				reason: "Default participant",
			});
		}

		const defaults = body.defaultTimelineItems ?? [];
		const createdItemsWithActors =
			defaults.length > 0
				? await Promise.all(
						defaults.map(async (item) => {
							if ((item.type ?? "message") === "message") {
								return createMessageTimelineItem({
									db,
									organizationId: organization.id,
									websiteId: website.id,
									conversationId: conversationRecord.id,
									conversationOwnerVisitorId: conversationRecord.visitorId,
									triggerNotificationWorkflow: false,
									text: item.text ?? "",
									extraParts:
										item.parts?.filter((part) => part.type !== "text") ?? [],
									visibility: item.visibility,
									userId: item.userId ?? null,
									aiAgentId: item.aiAgentId ?? null,
									visitorId: item.visitorId ?? null,
									createdAt: item.createdAt
										? new Date(item.createdAt)
										: undefined,
								});
							}

							const createdItem = await createTimelineItem({
								db,
								organizationId: organization.id,
								websiteId: website.id,
								conversationId: conversationRecord.id,
								conversationOwnerVisitorId: conversationRecord.visitorId,
								item: {
									type: item.type ?? "message",
									text: item.text,
									parts: item.parts,
									visibility: item.visibility,
									userId: item.userId ?? null,
									aiAgentId: item.aiAgentId ?? null,
									visitorId: item.visitorId ?? null,
									createdAt: item.createdAt
										? new Date(item.createdAt)
										: undefined,
								},
							});

							return { item: createdItem, actor: null };
						})
					)
				: [];

		const createdItems = createdItemsWithActors.map(({ item }) => item);

		// Get the last timeline item if any were sent
		const lastTimelineItem =
			createdItems.length > 0 ? createdItems.at(-1) : undefined;

		// Trigger notification workflow for any initial messages
		// This handles the case where a conversation is created with initial messages
		if (lastTimelineItem?.type === "message") {
			const lastItemActor = createdItemsWithActors.at(-1)?.actor;

			if (lastItemActor) {
				console.log(
					`[dev] Triggering notification for new conversation ${conversationRecord.id} with initial message ${lastTimelineItem.id} from ${lastItemActor.type}`
				);
				triggerMessageNotificationWorkflow({
					conversationId: conversationRecord.id,
					messageId: lastTimelineItem.id,
					websiteId: website.id,
					organizationId: organization.id,
					actor: lastItemActor,
				}).catch((error) => {
					console.error(
						"[dev] Failed to trigger notification workflow for new conversation:",
						error
					);
				});
			}
		}

		const header = await getConversationHeader(db, {
			organizationId: organization.id,
			websiteId: website.id,
			conversationId: conversationRecord.id,
			userId: null,
		});

		if (header) {
			const planInfo = await getPlanForWebsite(website);
			const hardLimitPolicy = resolveDashboardHardLimitPolicy(planInfo);
			const lockCutoff = await getDashboardConversationLockCutoff(db, {
				websiteId: website.id,
				organizationId: organization.id,
				policy: hardLimitPolicy,
			});
			const eventHeader = applyDashboardConversationHardLimit({
				conversation: header,
				policy: hardLimitPolicy,
				cutoff: lockCutoff,
			});

			await emitConversationCreatedEvent({
				conversation: conversationRecord,
				header: eventHeader,
			});
		}

		const response = {
			initialTimelineItems: createdItems.map(serializeTimelineItemForResponse),
			conversation: serializeConversationForResponse({
				...conversationRecord,
				lastTimelineItem,
			}),
		};

		return c.json(validateResponse(response, createConversationResponseSchema));
	}
);

conversationRouter.openapi(
	{
		method: "get",
		path: "/",
		summary: "List conversations for a visitor",
		description:
			"Fetch paginated list of conversations for a specific visitor with optional filters.",
		tags: ["Conversations"],
		request: {
			query: listConversationsRequestSchema,
		},
		responses: {
			200: {
				description: "List of conversations retrieved successfully",
				content: {
					"application/json": {
						schema: listConversationsResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
			{
				"Private API Key": [],
			},
		],
		parameters: [
			{
				name: "Authorization",
				in: "header",
				description:
					"Private API key in Bearer token format. Use this for server-to-server authentication. Format: `Bearer sk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^Bearer sk_(live|test)_[a-f0-9]{64}$",
					example: "Bearer sk_test_xxx",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
					example: "pk_test_xxx",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
					example: "01JG000000000000000000000",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, query, visitorIdHeader } =
			await safelyExtractRequestQuery(c, listConversationsRequestSchema);

		const visitor = await getVisitor(db, {
			visitorId: query.visitorId || visitorIdHeader,
		});

		if (!visitor) {
			return c.json(
				{
					error: "Visitor not found, please pass a valid visitorId",
				},
				400
			);
		}

		const result = await listConversations(db, {
			organizationId: organization.id,
			websiteId: website.id,
			visitorId: visitor.id,
			page: query.page,
			limit: query.limit,
			status: query.status,
			orderBy: query.orderBy,
			order: query.order,
		});

		const response = {
			conversations: result.conversations.map((conv) =>
				serializeConversationForResponse(conv)
			),
			pagination: result.pagination,
		};

		return c.json(validateResponse(response, listConversationsResponseSchema));
	}
);

conversationRouter.openapi(
	{
		method: "get",
		path: "/{conversationId}",
		summary: "Get a single conversation by ID",
		description: "Fetch a specific conversation by its ID.",
		tags: ["Conversations"],
		request: {
			params: getConversationRequestSchema,
		},
		responses: {
			200: {
				description: "Conversation retrieved successfully",
				content: {
					"application/json": {
						schema: getConversationResponseSchema,
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
			{
				"Private API Key": [],
			},
		],
		parameters: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation to retrieve",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "Authorization",
				in: "header",
				description:
					"Private API key in Bearer token format. Use this for server-to-server authentication. Format: `Bearer sk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^Bearer sk_(live|test)_[a-f0-9]{64}$",
					example: "Bearer sk_test_xxx",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
					example: "pk_test_xxx",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
					example: "01JG000000000000000000000",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization } = await safelyExtractRequestData(c);

		// Validate path params manually for now
		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const conversationRecord = await getConversationByIdWithLastMessage(db, {
			organizationId: organization.id,
			websiteId: website.id,
			conversationId: params.conversationId,
		});

		if (!conversationRecord) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		try {
			const response = {
				conversation: serializeConversationForResponse(conversationRecord),
			};

			return c.json(validateResponse(response, getConversationResponseSchema));
		} catch (error) {
			console.error(
				"[GET_CONVERSATION] Failed to serialize conversation response",
				{
					error,
					conversationId: params.conversationId,
					organizationId: organization.id,
					websiteId: website.id,
				}
			);

			return c.json(
				{ error: "Failed to serialize conversation response" },
				500
			);
		}
	}
);

conversationRouter.openapi(
	{
		method: "post",
		path: "/{conversationId}/seen",
		summary: "Mark a conversation as seen by the visitor",
		description:
			"Record a visitor's last seen timestamp for a specific conversation.",
		tags: ["Conversations"],
		request: {
			body: {
				required: false,
				content: {
					"application/json": {
						schema: markConversationSeenRequestSchema,
					},
				},
			},
		},
		responses: {
			200: {
				description: "Conversation seen timestamp recorded",
				content: {
					"application/json": {
						schema: markConversationSeenResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
		],
		inputSchema: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation to mark as seen",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
					example: "pk_test_xxx",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
					example: "01JG000000000000000000000",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, body, visitorIdHeader } =
			await safelyExtractRequestData(c, markConversationSeenRequestSchema);

		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const [visitor, conversationRecord] = await Promise.all([
			getVisitor(db, {
				visitorId: body.visitorId || visitorIdHeader,
			}),
			getConversationByIdWithLastMessage(db, {
				organizationId: organization.id,
				websiteId: website.id,
				conversationId: params.conversationId,
			}),
		]);

		if (!visitor || visitor.websiteId !== website.id) {
			return c.json(
				{
					error: "Visitor not found, please pass a valid visitorId",
				},
				400
			);
		}

		if (!conversationRecord || conversationRecord.visitorId !== visitor.id) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		const lastSeenAt = await markConversationAsSeenByVisitor(db, {
			conversation: conversationRecord,
			visitorId: visitor.id,
		});

		await emitConversationSeenEvent({
			conversation: conversationRecord,
			actor: { type: "visitor", visitorId: visitor.id },
			lastSeenAt,
		});

		const response = {
			conversationId: conversationRecord.id,
			lastSeenAt,
		};

		return c.json(
			validateResponse(response, markConversationSeenResponseSchema),
			200
		);
	}
);

conversationRouter.openapi(
	{
		method: "post",
		path: "/{conversationId}/typing",
		summary: "Report a visitor typing state",
		description:
			"Emit a typing indicator event for the visitor. Either visitorId must be provided via body or headers.",
		tags: ["Conversations"],
		request: {
			body: {
				required: true,
				content: {
					"application/json": {
						schema: setConversationTypingRequestSchema,
					},
				},
			},
		},
		responses: {
			200: {
				description: "Typing state recorded",
				content: {
					"application/json": {
						schema: setConversationTypingResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
		],
		inputSchema: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation receiving the typing update",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, body, visitorIdHeader } =
			await safelyExtractRequestData(c, setConversationTypingRequestSchema);

		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const [visitor, conversationRecord] = await Promise.all([
			getVisitor(db, {
				visitorId: body.visitorId || visitorIdHeader,
			}),
			getConversationByIdWithLastMessage(db, {
				organizationId: organization.id,
				websiteId: website.id,
				conversationId: params.conversationId,
			}),
		]);

		if (!visitor || visitor.websiteId !== website.id) {
			return c.json(
				{
					error: "Visitor not found, please pass a valid visitorId",
				},
				400
			);
		}

		if (!conversationRecord || conversationRecord.visitorId !== visitor.id) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		const trimmedPreview = body.visitorPreview?.trim() ?? "";
		const effectivePreview =
			body.isTyping && trimmedPreview.length > 0
				? trimmedPreview.slice(0, 2000)
				: null;

		await emitConversationTypingEvent({
			conversation: conversationRecord,
			actor: { type: "visitor", visitorId: visitor.id },
			isTyping: body.isTyping,
			visitorPreview: effectivePreview ?? undefined,
		});

		const sentAt = new Date();

		await markVisitorPresence({
			websiteId: website.id,
			visitorId: visitor.id,
			lastSeenAt: sentAt,
			geo: extractGeoFromVisitor(visitor),
		});

		const response = {
			conversationId: conversationRecord.id,
			isTyping: body.isTyping,
			visitorPreview: effectivePreview,
			sentAt: sentAt.toISOString(),
		};

		return c.json(
			validateResponse(response, setConversationTypingResponseSchema),
			200
		);
	}
);

conversationRouter.openapi(
	{
		method: "post",
		path: "/{conversationId}/rating",
		summary: "Submit a visitor rating for a conversation",
		description:
			"Record a visitor rating (1-5) for a resolved conversation. Requires visitor ownership.",
		tags: ["Conversations"],
		request: {
			body: {
				required: true,
				content: {
					"application/json": {
						schema: submitConversationRatingRequestSchema,
					},
				},
			},
		},
		responses: {
			200: {
				description: "Conversation rating recorded",
				content: {
					"application/json": {
						schema: submitConversationRatingResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
			403: {
				description: "Forbidden",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
		],
		inputSchema: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation to rate",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description:
					"Public API key for browser-based authentication. Can only be used from whitelisted domains. Format: `pk_[live|test]_...`",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
					example: "pk_test_xxx",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
					example: "01JG000000000000000000000",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, body, visitorIdHeader } =
			await safelyExtractRequestData(c, submitConversationRatingRequestSchema);

		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const [visitor, conversationRecord] = await Promise.all([
			getVisitor(db, {
				visitorId: body.visitorId || visitorIdHeader,
			}),
			getConversationByIdWithLastMessage(db, {
				organizationId: organization.id,
				websiteId: website.id,
				conversationId: params.conversationId,
			}),
		]);

		if (!visitor || visitor.websiteId !== website.id) {
			return c.json(
				{
					error: "Visitor not found, please pass a valid visitorId",
				},
				400
			);
		}

		if (!conversationRecord || conversationRecord.visitorId !== visitor.id) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		if (conversationRecord.status !== "resolved") {
			return c.json(
				{
					error: "Conversation must be resolved before submitting a rating",
				},
				403
			);
		}

		const ratedAt = new Date().toISOString();

		// Update conversation with rating (legacy field for backward compatibility)
		await db
			.update(conversation)
			.set({
				visitorRating: body.rating,
				visitorRatingAt: ratedAt,
				updatedAt: ratedAt,
			})
			.where(eq(conversation.id, conversationRecord.id));

		// Also create a feedback record in the new feedback table
		await createFeedback(db, {
			organizationId: organization.id,
			websiteId: website.id,
			conversationId: conversationRecord.id,
			visitorId: visitor.id,
			contactId: visitor.contactId ?? undefined,
			rating: body.rating,
			comment: body.comment,
			trigger: "conversation_resolved",
			source: "widget",
		});

		// Track feedback metric
		trackConversationMetric({
			website_id: website.id,
			visitor_id: visitor.id,
			conversation_id: conversationRecord.id,
			event_type: "feedback_submitted",
		});

		const response = {
			conversationId: conversationRecord.id,
			rating: body.rating,
			ratedAt,
		};

		return c.json(
			validateResponse(response, submitConversationRatingResponseSchema),
			200
		);
	}
);

// GET /conversations/:conversationId/seen - Fetch seen data for a conversation
conversationRouter.openapi(
	{
		method: "get",
		path: "/{conversationId}/seen",
		summary: "Get conversation seen data",
		description:
			"Fetch the seen data (read receipts) for a conversation, showing who has seen messages and when.",
		tags: ["Conversations"],
		responses: {
			200: {
				description: "Seen data retrieved successfully",
				content: {
					"application/json": {
						schema: z.object({
							seenData: z.array(conversationSeenSchema),
						}),
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
		],
		inputSchema: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description: "Public API key for browser-based authentication.",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization } = await safelyExtractRequestQuery(
			c,
			z.object({})
		);

		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const conversationRecord = await getConversationByIdWithLastMessage(db, {
			organizationId: organization.id,
			websiteId: website.id,
			conversationId: params.conversationId,
		});

		if (!conversationRecord) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		const seenData = await getConversationSeenData(db, {
			conversationId: params.conversationId,
			organizationId: organization.id,
		});

		return c.json({ seenData }, 200);
	}
);

// GET /conversations/:conversationId/timeline - Fetch timeline items for a conversation
conversationRouter.openapi(
	{
		method: "get",
		path: "/{conversationId}/timeline",
		summary: "Get conversation timeline items",
		description:
			"Fetch paginated timeline items (messages and events) for a conversation in chronological order.",
		tags: ["Conversations"],
		request: {
			query: getConversationTimelineItemsRequestSchema,
		},
		responses: {
			200: {
				description: "Timeline items retrieved successfully",
				content: {
					"application/json": {
						schema: getConversationTimelineItemsResponseSchema,
					},
				},
			},
			404: {
				description: "Conversation not found",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
		},
		security: [
			{
				"Public API Key": [],
			},
		],
		inputSchema: [
			{
				name: "conversationId",
				in: "path",
				description: "The ID of the conversation",
				required: true,
				schema: {
					type: "string",
				},
			},
			{
				name: "X-Public-Key",
				in: "header",
				description: "Public API key for browser-based authentication.",
				required: false,
				schema: {
					type: "string",
					pattern: "^pk_(live|test)_[a-f0-9]{64}$",
				},
			},
			{
				name: "X-Visitor-Id",
				in: "header",
				description: "Visitor ID from localStorage.",
				required: false,
				schema: {
					type: "string",
					pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
				},
			},
		],
	},
	async (c) => {
		const { db, website, organization, query, apiKey } =
			await safelyExtractRequestQuery(
				c,
				getConversationTimelineItemsRequestSchema
			);

		const params = getConversationRequestSchema.parse({
			conversationId: c.req.param("conversationId"),
		});

		const conversationRecord = await getConversationByIdWithLastMessage(db, {
			organizationId: organization.id,
			websiteId: website.id,
			conversationId: params.conversationId,
		});

		if (!conversationRecord) {
			return c.json(
				{
					error: "Conversation not found",
				},
				404
			);
		}

		const visibilityFilter =
			apiKey?.keyType === APIKeyType.PUBLIC
				? [TimelineItemVisibility.PUBLIC]
				: undefined;

		const result = await getConversationTimelineItems(db, {
			organizationId: organization.id,
			conversationId: params.conversationId,
			websiteId: website.id,
			limit: query.limit,
			cursor: query.cursor,
			visibility: visibilityFilter,
		});

		return c.json(
			{
				items: result.items as TimelineItem[],
				nextCursor: result.nextCursor ?? null,
				hasNextPage: result.hasNextPage,
			},
			200
		);
	}
);
