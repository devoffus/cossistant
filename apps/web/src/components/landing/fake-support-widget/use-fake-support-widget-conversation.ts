import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationTimelineItem } from "@/data/conversation-message-cache";
import { useAnimationScheduler } from "@/hooks/use-animation-scheduler";
import type { FakeSupportTypingActor } from "./types";

const ANTHONY_RIERA_ID = "01JGUSER1111111111111111";
const THUMBNAIL_AI_ID = "01JGAIA11111111111111111";
const MARC_VISITOR_ID = "01JGVIS22222222222222222";
const CONVERSATION_ID = "01JGAA2222222222222222222";

const VISITOR_ISSUE_TEXT =
	"Hey, on the Cinematic preset your generator keeps cropping my face out of the thumbnail.";
const AI_FIX_REPLY_TEXT =
	"Thanks for flagging this. I found the Cinematic padding bug and applied a fix. Refresh once and run it again, your face should stay centered now.";
const VISITOR_REQUESTS_HUMAN_TEXT =
	"That fixed it, thank you. Could I grab a human for a quick feature feedback note?";
const HUMAN_INVITE_TEXT = "Absolutely, I just joined. Happy to hear your idea.";
const VISITOR_FEATURE_FEEDBACK_TEXT =
	"I love the product. Quick ask: can we auto-generate 3 thumbnail variants for A/B tests in one click?";
const HUMAN_CLOSE_TEXT =
	"Great suggestion. I'm happy to talk through it and I'll pass this straight to product.";

type UseFakeSupportWidgetConversationProps = {
	isPlaying: boolean;
	onComplete?: () => void;
};

function createTypingPreview(fullText: string, progress: number): string {
	const charsToShow = Math.floor((fullText.length * progress) / 100);
	return fullText.slice(0, charsToShow);
}

function createMessage(params: {
	id: string;
	text: string;
	userId: string | null;
	visitorId: string | null;
	aiAgentId: string | null;
	timestamp: Date;
}): ConversationTimelineItem {
	return {
		id: params.id,
		conversationId: CONVERSATION_ID,
		organizationId: "01JGORG11111111111111111",
		visibility: "public",
		type: "message",
		text: params.text,
		parts: [{ type: "text", text: params.text }],
		userId: params.userId,
		visitorId: params.visitorId,
		aiAgentId: params.aiAgentId,
		createdAt: params.timestamp.toISOString(),
		deletedAt: null,
	};
}

function createEvent(params: {
	id: string;
	eventType: "participant_joined" | "participant_requested";
	actorUserId: string | null;
	actorAiAgentId?: string | null;
	timestamp: Date;
}): ConversationTimelineItem {
	return {
		id: params.id,
		conversationId: CONVERSATION_ID,
		organizationId: "01JGORG11111111111111111",
		visibility: "public",
		type: "event",
		text: null,
		parts: [
			{
				type: "event",
				eventType: params.eventType,
				actorUserId: params.actorUserId,
				actorAiAgentId: params.actorAiAgentId ?? null,
				targetUserId: null,
				targetAiAgentId: null,
				message: null,
			},
		],
		userId: null,
		visitorId: null,
		aiAgentId: null,
		createdAt: params.timestamp.toISOString(),
		deletedAt: null,
	};
}

export function useFakeSupportWidgetConversation({
	isPlaying,
	onComplete,
}: UseFakeSupportWidgetConversationProps) {
	const [timelineItems, setTimelineItems] = useState<
		ConversationTimelineItem[]
	>([]);
	const [typingActors, setTypingActors] = useState<FakeSupportTypingActor[]>(
		[]
	);
	const [isConversationClosed, setIsConversationClosed] = useState(false);
	const hasScheduledRef = useRef(false);
	const scheduleRef = useRef<
		((timeMs: number, callback: () => void) => () => void) | null
	>(null);

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
		setIsConversationClosed(false);
		resetScheduler();
		hasScheduledRef.current = false;
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

			currentSchedule(1000, () => {
				setTimelineItems([
					createMessage({
						id: "01JGTIM44444444444444431",
						text: VISITOR_ISSUE_TEXT,
						userId: null,
						visitorId: MARC_VISITOR_ID,
						aiAgentId: null,
						timestamp: new Date(now + 1000),
					}),
				]);
			});

			currentSchedule(3200, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: THUMBNAIL_AI_ID,
						actorType: "ai",
						preview: createTypingPreview(AI_FIX_REPLY_TEXT, 35),
					},
				]);
			});

			currentSchedule(4700, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: THUMBNAIL_AI_ID,
						actorType: "ai",
						preview: createTypingPreview(AI_FIX_REPLY_TEXT, 80),
					},
				]);
			});

			currentSchedule(6200, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM44444444444444432",
						text: AI_FIX_REPLY_TEXT,
						userId: null,
						visitorId: null,
						aiAgentId: THUMBNAIL_AI_ID,
						timestamp: new Date(now + 6200),
					})
				);
			});

			currentSchedule(9100, () => {
				appendTimelineItems(
					createMessage({
						id: "01JGTIM44444444444444433",
						text: VISITOR_REQUESTS_HUMAN_TEXT,
						userId: null,
						visitorId: MARC_VISITOR_ID,
						aiAgentId: null,
						timestamp: new Date(now + 9100),
					})
				);
			});

			currentSchedule(10_200, () => {
				appendTimelineItems(
					createEvent({
						id: "01JGEVE44444444444444430",
						eventType: "participant_requested",
						actorUserId: null,
						actorAiAgentId: THUMBNAIL_AI_ID,
						timestamp: new Date(now + 10_200),
					})
				);
			});

			currentSchedule(11_700, () => {
				appendTimelineItems(
					createEvent({
						id: "01JGEVE44444444444444431",
						eventType: "participant_joined",
						actorUserId: ANTHONY_RIERA_ID,
						timestamp: new Date(now + 11_700),
					})
				);
			});

			currentSchedule(12_900, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: ANTHONY_RIERA_ID,
						actorType: "team_member",
						preview: createTypingPreview(HUMAN_INVITE_TEXT, 35),
					},
				]);
			});

			currentSchedule(14_000, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: ANTHONY_RIERA_ID,
						actorType: "team_member",
						preview: createTypingPreview(HUMAN_INVITE_TEXT, 80),
					},
				]);
			});

			currentSchedule(15_100, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM44444444444444434",
						text: HUMAN_INVITE_TEXT,
						userId: ANTHONY_RIERA_ID,
						visitorId: null,
						aiAgentId: null,
						timestamp: new Date(now + 15_100),
					})
				);
			});

			currentSchedule(17_800, () => {
				appendTimelineItems(
					createMessage({
						id: "01JGTIM44444444444444435",
						text: VISITOR_FEATURE_FEEDBACK_TEXT,
						userId: null,
						visitorId: MARC_VISITOR_ID,
						aiAgentId: null,
						timestamp: new Date(now + 17_800),
					})
				);
			});

			currentSchedule(19_100, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: ANTHONY_RIERA_ID,
						actorType: "team_member",
						preview: createTypingPreview(HUMAN_CLOSE_TEXT, 35),
					},
				]);
			});

			currentSchedule(20_300, () => {
				setTypingActors([
					{
						conversationId: CONVERSATION_ID,
						actorId: ANTHONY_RIERA_ID,
						actorType: "team_member",
						preview: createTypingPreview(HUMAN_CLOSE_TEXT, 80),
					},
				]);
			});

			currentSchedule(21_300, () => {
				setTypingActors([]);
				appendTimelineItems(
					createMessage({
						id: "01JGTIM44444444444444436",
						text: HUMAN_CLOSE_TEXT,
						userId: ANTHONY_RIERA_ID,
						visitorId: null,
						aiAgentId: null,
						timestamp: new Date(now + 21_300),
					})
				);
			});

			currentSchedule(22_900, () => {
				setIsConversationClosed(true);
			});

			currentSchedule(24_000, () => {});
		};

		scheduleTasks();
	}, [appendTimelineItems, isPlaying]);

	return {
		timelineItems,
		typingActors,
		isConversationClosed,
		resetDemoData,
	};
}
