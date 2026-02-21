import { describe, expect, it } from "bun:test";
import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConversationHeader } from "@/contexts/inboxes";
import type { ConversationTimelineItem } from "@/data/conversation-message-cache";
import { fakeAIAgent } from "../data";
import { FakeConversationTimelineList } from "./fake-conversation-timeline-list";

function createTimelineItem(overrides: Partial<TimelineItem>): TimelineItem {
	return {
		id: "item-1",
		conversationId: "conv-1",
		organizationId: "org-1",
		visibility: "public",
		type: "event",
		text: null,
		parts: [],
		userId: null,
		visitorId: null,
		aiAgentId: null,
		tool: null,
		createdAt: "2026-01-01T10:00:00.000Z",
		deletedAt: null,
		...overrides,
	};
}

function createEventItem(id: string, createdAt: string): TimelineItem {
	return createTimelineItem({
		id,
		type: "event",
		userId: "01JGUSER1111111111111111",
		createdAt,
		parts: [
			{
				type: "event",
				eventType: "participant_joined",
				actorUserId: "01JGUSER1111111111111111",
				actorAiAgentId: null,
				targetUserId: null,
				targetAiAgentId: null,
				message: null,
			},
		],
	});
}

function createToolItem(id: string, createdAt: string): TimelineItem {
	return createTimelineItem({
		id,
		type: "tool",
		userId: "01JGUSER1111111111111111",
		text: "Updated sentiment to positive",
		tool: "updateSentiment",
		createdAt,
		parts: [
			{
				type: "tool-updateSentiment",
				toolCallId: `${id}-call`,
				toolName: "updateSentiment",
				input: {},
				state: "result",
			},
		],
	});
}

const VISITOR = {
	id: "visitor-1",
	contact: {
		name: "Marc",
		email: "marc@example.com",
		image: null,
	},
} as unknown as ConversationHeader["visitor"];

describe("FakeDashboard timeline activity grouping", () => {
	it("uses tree prefixes for grouped activity rows and keeps sender identity visible", () => {
		const items = [
			createEventItem("event-1", "2026-01-01T10:00:00.000Z"),
			createToolItem("tool-1", "2026-01-01T10:01:00.000Z"),
		] as unknown as ConversationTimelineItem[];

		const html = renderToStaticMarkup(
			React.createElement(FakeConversationTimelineList, {
				items,
				visitor: VISITOR,
				typingActors: [],
			})
		);

		expect(html).toContain('data-activity-tree-prefix="event"');
		expect(html).toContain('data-activity-tree-prefix="tool"');
		expect(html).not.toContain("data-activity-bullet=");
		expect(html).toContain('data-slot="avatar"');
		expect(html).not.toContain("flex-row-reverse");
		expect(html).not.toContain("mb-2 px-1 text-muted-foreground text-xs");
	});

	it("renders AI tool workflow details with known tool renderers", () => {
		const items = [
			createTimelineItem({
				id: "ai-message-1",
				type: "message",
				text: "I'm checking your setup now.",
				parts: [{ type: "text", text: "I'm checking your setup now." }],
				userId: null,
				visitorId: null,
				aiAgentId: fakeAIAgent.id,
				createdAt: "2026-01-01T10:00:00.000Z",
			}),
			createTimelineItem({
				id: "tool-search-result",
				type: "tool",
				tool: "searchKnowledgeBase",
				text: "Found 3 sources",
				parts: [
					{
						type: "tool-searchKnowledgeBase",
						toolCallId: "call-search-1",
						toolName: "searchKnowledgeBase",
						input: { query: "cors allowlist" },
						state: "result",
						output: {
							success: true,
							data: {
								totalFound: 3,
								articles: [
									{
										title: "Allowed Origins",
										sourceUrl: "https://example.com/a",
									},
									{
										title: "Embed Checklist",
										sourceUrl: "https://example.com/b",
									},
									{ title: "CORS Guide", sourceUrl: "https://example.com/c" },
								],
							},
						},
					},
				],
				userId: null,
				visitorId: null,
				aiAgentId: fakeAIAgent.id,
				createdAt: "2026-01-01T10:01:00.000Z",
			}),
			createTimelineItem({
				id: "tool-title-result",
				type: "tool",
				tool: "updateConversationTitle",
				text: 'Updated conversation title to "Help with production widget"',
				parts: [
					{
						type: "tool-updateConversationTitle",
						toolCallId: "call-title-1",
						toolName: "updateConversationTitle",
						input: { title: "Help with production widget" },
						state: "result",
						output: {
							success: true,
							data: { title: "Help with production widget" },
						},
					},
				],
				userId: null,
				visitorId: null,
				aiAgentId: fakeAIAgent.id,
				createdAt: "2026-01-01T10:02:00.000Z",
			}),
		] as unknown as ConversationTimelineItem[];

		const html = renderToStaticMarkup(
			React.createElement(FakeConversationTimelineList, {
				items,
				visitor: VISITOR,
				typingActors: [],
			})
		);

		expect(html).toContain("Cossistant AI");
		expect(html).toContain("Found 3 sources");
		expect(html).toContain("Changed title to");
	});
});
