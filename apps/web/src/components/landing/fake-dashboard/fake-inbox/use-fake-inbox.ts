import type { ConversationHeader } from "@cossistant/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimationScheduler } from "@/hooks/use-animation-scheduler";
import {
	createMarcConversation,
	type FakeTypingActor,
	fakeAIAgent,
	fakeConversations,
	MARC_CONVERSATION_ID,
} from "../data";

type UseFakeInboxProps = {
	isPlaying: boolean;
	onComplete?: () => void;
	onShowMouseCursor?: () => void;
};

function createResolvedEventTimelineItem(
	conversationId: string,
	resolvedAt: string
): NonNullable<ConversationHeader["lastTimelineItem"]> {
	return {
		id: `${conversationId}-resolved-event`,
		conversationId,
		organizationId: "01JGORG11111111111111111",
		visibility: "public",
		type: "event",
		text: null,
		parts: [
			{
				type: "event",
				eventType: "resolved",
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
		createdAt: resolvedAt,
		deletedAt: null,
	};
}

export function useFakeInbox({
	isPlaying,
	onComplete,
	onShowMouseCursor,
}: UseFakeInboxProps) {
	const [conversations, setConversations] =
		useState<ConversationHeader[]>(fakeConversations);
	const [typingActors, setTypingActors] = useState<FakeTypingActor[]>([]);
	const [inboxMessages, setInboxMessages] = useState<
		Array<{ text: string; timestamp: Date }>
	>([]);
	const hasScheduledRef = useRef(false);
	const scheduleRef = useRef<
		((timeMs: number, callback: () => void) => () => void) | null
	>(null);
	const onShowMouseCursorRef = useRef(onShowMouseCursor);
	const retryCountRef = useRef(0);

	useEffect(() => {
		onShowMouseCursorRef.current = onShowMouseCursor;
	}, [onShowMouseCursor]);

	const { schedule, reset: resetScheduler } = useAnimationScheduler({
		isPlaying,
		onComplete,
	});

	scheduleRef.current = schedule;
	useEffect(() => {
		scheduleRef.current = schedule;
	}, [schedule]);

	const resetDemoData = useCallback(() => {
		setConversations(fakeConversations);
		setTypingActors([]);
		setInboxMessages([]);
		resetScheduler();
		hasScheduledRef.current = false;
		retryCountRef.current = 0;
	}, [resetScheduler]);

	const markConversationResolved = useCallback((conversationId: string) => {
		const resolvedAt = new Date().toISOString();
		setTypingActors((prev) =>
			prev.filter((actor) => actor.conversationId !== conversationId)
		);
		setConversations((prev) =>
			prev.map((conversation) => {
				if (conversation.id !== conversationId) {
					return conversation;
				}

				return {
					...conversation,
					status: "resolved",
					resolvedAt,
					resolvedByAiAgentId: fakeAIAgent.id,
					updatedAt: resolvedAt,
					lastTimelineItem: createResolvedEventTimelineItem(
						conversationId,
						resolvedAt
					),
				};
			})
		);
	}, []);

	useEffect(() => {
		if (!isPlaying || hasScheduledRef.current) {
			return;
		}

		const scheduleTasks = () => {
			const currentSchedule = scheduleRef.current;
			if (!currentSchedule) {
				retryCountRef.current += 1;
				if (retryCountRef.current > 10) {
					return;
				}
				setTimeout(scheduleTasks, 10);
				return;
			}

			hasScheduledRef.current = true;
			retryCountRef.current = 0;

			setConversations((prev) =>
				prev.filter((conversation) => conversation.id !== MARC_CONVERSATION_ID)
			);

			currentSchedule(1000, () => {
				const firstMessageText =
					"Hey! The widget isn't loading on my production site. It works fine locally though.";
				const firstTimestamp = new Date();
				setInboxMessages([
					{ text: firstMessageText, timestamp: firstTimestamp },
				]);

				setConversations((prev) => {
					const withoutMarc = prev.filter(
						(conversation) => conversation.id !== MARC_CONVERSATION_ID
					);
					return [
						createMarcConversation(firstMessageText, firstTimestamp),
						...withoutMarc,
					];
				});
			});

			currentSchedule(2200, () => {
				setTypingActors([
					{
						conversationId: MARC_CONVERSATION_ID,
						actorType: "ai_agent",
						actorId: fakeAIAgent.id,
						preview: null,
					},
				]);
			});

			currentSchedule(3600, () => {
				onShowMouseCursorRef.current?.();
			});
		};

		scheduleTasks();
	}, [isPlaying]);

	return {
		conversations,
		typingActors,
		resetDemoData,
		inboxMessages,
		markConversationResolved,
	};
}
