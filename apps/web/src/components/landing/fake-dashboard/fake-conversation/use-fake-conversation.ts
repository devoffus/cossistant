import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationTimelineItem } from "@/data/conversation-message-cache";
import { useAnimationScheduler } from "@/hooks/use-animation-scheduler";
import {
	createMarcConversation,
	type FakeTypingActor,
	fakeAIAgent,
	MARC_CONVERSATION_ID,
	MARC_VISITOR_ID,
	marcVisitor,
} from "../data";

const CONVERSATION_ID = MARC_CONVERSATION_ID;

type UseFakeConversationProps = {
	isPlaying: boolean;
	onComplete?: () => void;
	onConversationResolved?: (conversationId: string) => void;
	initialMessages?: Array<{ text: string; timestamp: Date }>;
};

export function useFakeConversation({
	isPlaying,
	onComplete,
	onConversationResolved,
	initialMessages = [],
}: UseFakeConversationProps) {
	const conversation = createMarcConversation(
		initialMessages[0]?.text ||
			"Hey! The widget isn't loading on my production site. It works fine locally though.",
		initialMessages[0]?.timestamp || new Date()
	);

	const [timelineItems, setTimelineItems] = useState<
		ConversationTimelineItem[]
	>([]);
	const [typingActors, setTypingActors] = useState<FakeTypingActor[]>([]);
	const hasScheduledRef = useRef(false);
	const scheduleRef = useRef<
		((timeMs: number, callback: () => void) => () => void) | null
	>(null);
	const onConversationResolvedRef = useRef(onConversationResolved);
	const initialMessagesRef = useRef(initialMessages);
	const hasInitializedRef = useRef(false);

	useEffect(() => {
		onConversationResolvedRef.current = onConversationResolved;
	}, [onConversationResolved]);

	useEffect(() => {
		const messagesChanged =
			initialMessagesRef.current.length !== initialMessages.length ||
			initialMessagesRef.current.some(
				(msg, index) =>
					msg.text !== initialMessages[index]?.text ||
					msg.timestamp.getTime() !==
						initialMessages[index]?.timestamp.getTime()
			);

		if (messagesChanged) {
			initialMessagesRef.current = initialMessages;
			hasInitializedRef.current = false;
			hasScheduledRef.current = false;
		}
	}, [initialMessages]);

	const { schedule, reset: resetScheduler } = useAnimationScheduler({
		isPlaying,
		onComplete,
	});

	scheduleRef.current = schedule;
	useEffect(() => {
		scheduleRef.current = schedule;
	}, [schedule]);

	const appendTimelineItems = useCallback(
		(newItems: ConversationTimelineItem | ConversationTimelineItem[]) => {
			const itemsArray = Array.isArray(newItems) ? newItems : [newItems];
			if (itemsArray.length === 0) {
				return;
			}

			setTimelineItems((prev) => {
				const existingIds = new Set(prev.map((item) => item.id));
				const dedupedItems = itemsArray.filter((item) => {
					if (existingIds.has(item.id)) {
						return false;
					}
					existingIds.add(item.id);
					return true;
				});

				if (dedupedItems.length === 0) {
					return prev;
				}

				return [...prev, ...dedupedItems];
			});
		},
		[]
	);

	const resetDemoData = useCallback(() => {
		setTimelineItems([]);
		setTypingActors([]);
		resetScheduler();
		hasScheduledRef.current = false;
		hasInitializedRef.current = false;
	}, [resetScheduler]);

	useEffect(() => {
		if (!isPlaying || hasScheduledRef.current) {
			return;
		}

		const scheduleTasks = () => {
			const currentSchedule = scheduleRef.current;
			if (!currentSchedule) {
				setTimeout(scheduleTasks, 10);
				return;
			}

			hasScheduledRef.current = true;
			const now = Date.now();

			const createMessage = (params: {
				id: string;
				text: string;
				userId: string | null;
				visitorId: string | null;
				aiAgentId: string | null;
				timestamp: Date;
			}): ConversationTimelineItem => ({
				id: params.id,
				conversationId: CONVERSATION_ID,
				organizationId: "01JGORG11111111111111111",
				visibility: "public" as const,
				type: "message" as const,
				text: params.text,
				parts: [{ type: "text" as const, text: params.text }],
				userId: params.userId,
				visitorId: params.visitorId,
				aiAgentId: params.aiAgentId,
				createdAt: params.timestamp.toISOString(),
				deletedAt: null,
			});

			const createTool = (params: {
				id: string;
				toolCallId: string;
				toolName: "searchKnowledgeBase" | "updateConversationTitle";
				state: "partial" | "result";
				text: string;
				input: Record<string, unknown>;
				output?: Record<string, unknown>;
				timestamp: Date;
			}): ConversationTimelineItem => ({
				id: params.id,
				conversationId: CONVERSATION_ID,
				organizationId: "01JGORG11111111111111111",
				visibility: "public" as const,
				type: "tool" as const,
				text: params.text,
				parts: [
					{
						type: `tool-${params.toolName}`,
						toolCallId: params.toolCallId,
						toolName: params.toolName,
						input: params.input,
						state: params.state,
						output: params.output,
					},
				],
				userId: null,
				visitorId: null,
				aiAgentId: fakeAIAgent.id,
				createdAt: params.timestamp.toISOString(),
				deletedAt: null,
			});

			const createEvent = (params: {
				id: string;
				eventType: "resolved";
				timestamp: Date;
			}): ConversationTimelineItem => ({
				id: params.id,
				conversationId: CONVERSATION_ID,
				organizationId: "01JGORG11111111111111111",
				visibility: "public" as const,
				type: "event" as const,
				text: null,
				parts: [
					{
						type: "event" as const,
						eventType: params.eventType,
						actorUserId: null,
						actorAiAgentId: fakeAIAgent.id,
						targetUserId: null,
						targetAiAgentId: null,
						message: null,
					},
				],
				userId: null,
				visitorId: null,
				aiAgentId: fakeAIAgent.id,
				createdAt: params.timestamp.toISOString(),
				deletedAt: null,
			});

			if (!hasInitializedRef.current) {
				const initialTimelineItems: ConversationTimelineItem[] = [];
				if (initialMessagesRef.current.length > 0) {
					initialMessagesRef.current.forEach((message, index) => {
						initialTimelineItems.push(
							createMessage({
								id:
									index === 0
										? "01JGTIM22222222222222222"
										: `01JGTIM2222222222222222${index + 1}`,
								text: message.text,
								userId: null,
								visitorId: MARC_VISITOR_ID,
								aiAgentId: null,
								timestamp: message.timestamp,
							})
						);
					});
				} else {
					initialTimelineItems.push(
						createMessage({
							id: "01JGTIM22222222222222222",
							text: "Hey! The widget isn't loading on my production site. It works fine locally though.",
							userId: null,
							visitorId: MARC_VISITOR_ID,
							aiAgentId: null,
							timestamp: new Date(now),
						})
					);
				}

				setTimelineItems(initialTimelineItems);
				hasInitializedRef.current = true;
			}

			currentSchedule(900, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorType: "ai_agent",
						actorId: fakeAIAgent.id,
						preview: null,
					},
				]);
			});

			currentSchedule(2200, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM22222222222222231",
						text: "I'm on it. I'll check your embed setup and compare it with your allowed origins.",
						userId: null,
						visitorId: null,
						aiAgentId: fakeAIAgent.id,
						timestamp: new Date(now + 2200),
					})
				);
			});

			currentSchedule(2800, () => {
				appendTimelineItems(
					createTool({
						id: "01JGTLT22222222222222232",
						toolCallId: "call-search-kb-1",
						toolName: "searchKnowledgeBase",
						state: "partial",
						text: "Searching knowledge base...",
						input: { query: "widget production CORS allowlist" },
						timestamp: new Date(now + 2800),
					})
				);
			});

			currentSchedule(3600, () => {
				appendTimelineItems(
					createTool({
						id: "01JGTLT22222222222222233",
						toolCallId: "call-search-kb-1",
						toolName: "searchKnowledgeBase",
						state: "result",
						text: "Found 3 sources",
						input: { query: "widget production CORS allowlist" },
						output: {
							success: true,
							data: {
								totalFound: 3,
								articles: [
									{
										title: "Allowed Origins for Production Domains",
										sourceUrl:
											"https://docs.cossistant.com/security/allowed-origins",
									},
									{
										title: "Widget Embed Checklist",
										sourceUrl:
											"https://docs.cossistant.com/widget/embed-checklist",
									},
									{
										title: "Troubleshooting CORS Errors",
										sourceUrl:
											"https://docs.cossistant.com/troubleshooting/cors",
									},
								],
							},
						},
						timestamp: new Date(now + 3600),
					})
				);
			});

			currentSchedule(4300, () => {
				appendTimelineItems(
					createTool({
						id: "01JGTLT22222222222222234",
						toolCallId: "call-update-title-1",
						toolName: "updateConversationTitle",
						state: "partial",
						text: "Updating title...",
						input: { title: "Widget blocked by missing allowlist domain" },
						timestamp: new Date(now + 4300),
					})
				);
			});

			currentSchedule(5000, () => {
				appendTimelineItems(
					createTool({
						id: "01JGTLT22222222222222235",
						toolCallId: "call-update-title-1",
						toolName: "updateConversationTitle",
						state: "result",
						text: 'Updated conversation title to "Widget blocked by missing allowlist domain"',
						input: { title: "Widget blocked by missing allowlist domain" },
						output: {
							success: true,
							data: { title: "Widget blocked by missing allowlist domain" },
						},
						timestamp: new Date(now + 5000),
					})
				);
			});

			currentSchedule(6100, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorType: "ai_agent",
						actorId: fakeAIAgent.id,
						preview: null,
					},
				]);
			});

			currentSchedule(7600, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM22222222222222236",
						text: "Found it. Your production domain was missing from allowed origins. I added shipfa.st and the widget should load now.",
						userId: null,
						visitorId: null,
						aiAgentId: fakeAIAgent.id,
						timestamp: new Date(now + 7600),
					})
				);
			});

			currentSchedule(9000, () => {
				appendTimelineItems(
					createMessage({
						id: "01JGTIM22222222222222237",
						text: "Just refreshed. It's loading perfectly now, thanks!",
						userId: null,
						visitorId: MARC_VISITOR_ID,
						aiAgentId: null,
						timestamp: new Date(now + 9000),
					})
				);
			});

			currentSchedule(9700, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorType: "ai_agent",
						actorId: fakeAIAgent.id,
						preview: null,
					},
				]);
			});

			currentSchedule(10_800, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM22222222222222238",
						text: "Amazing. I've marked this as resolved, but ping me anytime if it comes back.",
						userId: null,
						visitorId: null,
						aiAgentId: fakeAIAgent.id,
						timestamp: new Date(now + 10_800),
					})
				);
			});

			currentSchedule(11_600, () => {
				appendTimelineItems(
					createEvent({
						id: "01JGEVE22222222222222239",
						eventType: "resolved",
						timestamp: new Date(now + 11_600),
					})
				);
			});

			currentSchedule(11_800, () => {
				onConversationResolvedRef.current?.(CONVERSATION_ID);
			});

			// Keep a brief pause so the resolved event remains visible before the
			// scheduler triggers onComplete and transitions back to inbox.
			currentSchedule(12_600, () => {});
		};

		scheduleTasks();
	}, [appendTimelineItems, isPlaying]);

	return {
		conversation,
		timelineItems,
		visitor: marcVisitor,
		resetDemoData,
		typingActors,
	};
}
