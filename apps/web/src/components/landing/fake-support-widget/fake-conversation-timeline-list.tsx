"use client";

import {
	type GroupedActivity,
	useGroupedMessages,
} from "@cossistant/react/hooks";
import {
	ConversationTimelineContainer,
	ConversationTimeline as PrimitiveConversationTimeline,
	TimelineItemGroup as PrimitiveTimelineItemGroup,
	TimelineItemGroupAvatar,
	TimelineItemGroupContent,
} from "@cossistant/react/primitives";
import { Avatar } from "@cossistant/react/support/components/avatar";
import { ConversationEvent } from "@cossistant/react/support/components/conversation-event";
import { TimelineMessageGroup } from "@cossistant/react/support/components/timeline-message-group";
import {
	TypingIndicator,
	type TypingParticipant,
} from "@cossistant/react/support/components/typing-indicator";
import { cn } from "@cossistant/react/support/utils";
import type { AvailableAIAgent, AvailableHumanAgent } from "@cossistant/types";
import { SenderType } from "@cossistant/types";
import type {
	TimelineItem,
	TimelinePartEvent,
} from "@cossistant/types/api/timeline-item";
import { useEffect, useMemo, useRef } from "react";
import {
	renderEventActionIcon,
	renderToolActionIcon,
} from "@/components/conversation/messages/activity/action-icon-map";
import { shouldDisplayToolTimelineItem } from "@/lib/tool-timeline-visibility";
import type { FakeSupportTypingActor } from "./types";

function extractEventPart(item: TimelineItem): TimelinePartEvent | null {
	if (item.type !== "event") {
		return null;
	}

	const eventPart = item.parts.find(
		(part): part is TimelinePartEvent => part.type === "event"
	);

	return eventPart || null;
}

type ToolState = "partial" | "result" | "error";

type ToolDetails = {
	toolName: string | null;
	state: ToolState;
};

function extractToolDetails(item: TimelineItem): ToolDetails {
	let toolName =
		typeof item.tool === "string" && item.tool.length > 0 ? item.tool : null;
	let state: ToolState = "partial";

	for (const part of item.parts) {
		if (
			typeof part !== "object" ||
			part === null ||
			!("type" in part) ||
			typeof part.type !== "string" ||
			!part.type.startsWith("tool-")
		) {
			continue;
		}

		if (
			"toolName" in part &&
			typeof part.toolName === "string" &&
			part.toolName.length > 0
		) {
			toolName = part.toolName;
		}

		if ("state" in part && part.state === "result") {
			state = "result";
		} else if ("state" in part && part.state === "error") {
			state = "error";
		}

		break;
	}

	return {
		toolName,
		state,
	};
}

function getFallbackToolSummary(
	toolName: string | null,
	state: ToolState
): string {
	const label = toolName ?? "tool";

	if (state === "result") {
		return `Completed ${label}`;
	}

	if (state === "error") {
		return `Failed ${label}`;
	}

	return `Running ${label}`;
}

function formatToolSummary(item: TimelineItem, details: ToolDetails): string {
	if (typeof item.text === "string" && item.text.trim().length > 0) {
		return item.text;
	}

	return getFallbackToolSummary(details.toolName, details.state);
}

function formatTimestamp(createdAt: string): string {
	return new Date(createdAt).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

type ActivityRow =
	| {
			type: "event";
			key: string;
			item: TimelineItem;
			event: TimelinePartEvent;
	  }
	| {
			type: "tool";
			key: string;
			item: TimelineItem;
			toolName: string | null;
			summary: string;
	  };

type FakeTimelineActivityGroupProps = {
	group: GroupedActivity;
	availableAIAgents: AvailableAIAgent[];
	availableHumanAgents: AvailableHumanAgent[];
	currentVisitorId?: string;
};

function FakeTimelineActivityGroup({
	group,
	availableAIAgents,
	availableHumanAgents,
	currentVisitorId,
}: FakeTimelineActivityGroupProps) {
	const activityRows = useMemo(() => {
		const rows: ActivityRow[] = [];

		for (let index = 0; index < group.items.length; index++) {
			const item = group.items[index];
			if (!item) {
				continue;
			}

			if (item.type === "event") {
				const eventPart = extractEventPart(item);
				if (!eventPart) {
					continue;
				}

				rows.push({
					type: "event",
					key: item.id ?? `activity-event-${item.createdAt}-${index}`,
					item,
					event: eventPart,
				});
				continue;
			}

			if (item.type === "tool") {
				if (!shouldDisplayToolTimelineItem(item)) {
					continue;
				}

				const details = extractToolDetails(item);
				rows.push({
					type: "tool",
					key: item.id ?? `activity-tool-${item.createdAt}-${index}`,
					item,
					toolName: details.toolName,
					summary: formatToolSummary(item, details),
				});
			}
		}

		return rows;
	}, [group.items]);

	if (activityRows.length === 0) {
		return null;
	}

	const showRowBullets = activityRows.length > 1;
	const humanAgent = availableHumanAgents.find(
		(agent) => agent.id === group.senderId
	);
	const aiAgent = availableAIAgents.find(
		(agent) => agent.id === group.senderId
	);

	return (
		<PrimitiveTimelineItemGroup
			items={group.items}
			viewerId={currentVisitorId}
			viewerType={SenderType.VISITOR}
		>
			{({ isAI, isTeamMember, isVisitor }) => (
				<div className="flex w-full flex-row gap-2">
					<TimelineItemGroupAvatar className="flex shrink-0 flex-col justify-start">
						{isAI ? (
							<Avatar
								className="size-6"
								image={aiAgent?.image}
								isAI
								name={aiAgent?.name || "AI Assistant"}
								showBackground={!!aiAgent?.image}
							/>
						) : (
							<Avatar
								className="size-6"
								image={isTeamMember ? humanAgent?.image : null}
								name={
									isTeamMember
										? humanAgent?.name || "Support"
										: isVisitor
											? "Visitor"
											: "Support"
								}
							/>
						)}
					</TimelineItemGroupAvatar>

					<TimelineItemGroupContent className="flex min-w-0 flex-1 flex-col gap-1">
						<div className="flex w-full min-w-0 flex-col gap-1.5">
							{activityRows.map((row) => (
								<div
									className={cn(
										"flex w-full min-w-0 items-start",
										showRowBullets ? "gap-2" : "gap-0"
									)}
									key={row.key}
								>
									{showRowBullets ? (
										<span
											className="mt-[0.3rem] shrink-0"
											data-activity-bullet={row.type}
										>
											{row.type === "event"
												? renderEventActionIcon(
														row.event.eventType,
														"size-3 text-co-muted-foreground"
													)
												: renderToolActionIcon(
														row.toolName,
														"size-3 text-co-muted-foreground"
													)}
										</span>
									) : null}

									<div
										className={cn(
											"min-w-0",
											showRowBullets ? "flex-1" : "w-full"
										)}
									>
										{row.type === "event" ? (
											<ConversationEvent
												availableAIAgents={availableAIAgents}
												availableHumanAgents={availableHumanAgents}
												className="w-full"
												compact
												createdAt={row.item.createdAt}
												event={row.event}
												showAvatar={false}
											/>
										) : (
											<div className="flex min-h-5 items-center gap-2 text-co-muted-foreground text-xs">
												<span className="break-words">{row.summary}</span>
												<time className="text-[10px]">
													{formatTimestamp(row.item.createdAt)}
												</time>
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					</TimelineItemGroupContent>
				</div>
			)}
		</PrimitiveTimelineItemGroup>
	);
}

const EMPTY_SEEN_BY_IDS: readonly string[] = Object.freeze([]);
const EMPTY_SEEN_BY_NAMES: readonly string[] = Object.freeze([]);

type FakeConversationTimelineListProps = {
	conversationId: string;
	items: TimelineItem[];
	className?: string;
	availableAIAgents: AvailableAIAgent[];
	availableHumanAgents: AvailableHumanAgent[];
	currentVisitorId?: string;
	typingActors: FakeSupportTypingActor[];
};

export function FakeConversationTimelineList({
	conversationId: _conversationId,
	items: timelineItems,
	className,
	availableAIAgents = [],
	availableHumanAgents = [],
	currentVisitorId,
	typingActors,
}: FakeConversationTimelineListProps) {
	const messageListRef = useRef<HTMLDivElement | null>(null);

	const { items: groupedMessages } = useGroupedMessages({
		items: timelineItems,
		seenData: [],
		currentViewerId: currentVisitorId,
	});

	const typingIndicatorParticipants = useMemo<TypingParticipant[]>(
		() =>
			typingActors
				.filter((typingActor) => typingActor.actorId !== currentVisitorId)
				.map((typingActor) => ({
					id: typingActor.actorId,
					type: typingActor.actorType === "ai" ? "ai" : "team_member",
				})),
		[typingActors, currentVisitorId]
	);

	useEffect(() => {
		if (!messageListRef.current || typingIndicatorParticipants.length === 0) {
			return;
		}

		messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
	}, [typingIndicatorParticipants.length]);

	return (
		<PrimitiveConversationTimeline
			autoScroll={true}
			className={cn(
				"overflow-y-auto overflow-x-hidden px-3 py-6",
				"scrollbar-thin scrollbar-thumb-co-background-300 scrollbar-track-fd-overlay",
				"h-full w-full",
				className
			)}
			id="fake-conversation-timeline"
			items={timelineItems}
			ref={messageListRef}
			style={{ scrollbarGutter: "stable" }}
		>
			<ConversationTimelineContainer className="flex min-h-full w-full flex-col gap-5">
				{groupedMessages.map((item, index) => {
					if (item.type === "timeline_event") {
						const eventPart = extractEventPart(item.item);
						if (!eventPart) {
							return null;
						}

						return (
							<ConversationEvent
								availableAIAgents={availableAIAgents}
								availableHumanAgents={availableHumanAgents}
								createdAt={item.item.createdAt}
								event={eventPart}
								key={item.item.id ?? `timeline-event-${item.item.createdAt}`}
							/>
						);
					}

					if (item.type === "timeline_tool") {
						return null;
					}

					if (item.type === "activity_group") {
						const groupKey =
							item.firstItemId ??
							item.items[0]?.id ??
							`activity-group-${item.items[0]?.createdAt ?? index}`;

						return (
							<FakeTimelineActivityGroup
								availableAIAgents={availableAIAgents}
								availableHumanAgents={availableHumanAgents}
								currentVisitorId={currentVisitorId}
								group={item}
								key={groupKey}
							/>
						);
					}

					if (item.type === "day_separator") {
						return null;
					}

					const seenByIds = EMPTY_SEEN_BY_IDS;
					const seenByNames = EMPTY_SEEN_BY_NAMES;

					const groupKey =
						item.lastMessageId ??
						item.items[0]?.id ??
						`group-${item.items[0]?.createdAt ?? index}`;

					return (
						<TimelineMessageGroup
							availableAIAgents={availableAIAgents}
							availableHumanAgents={availableHumanAgents}
							currentVisitorId={currentVisitorId}
							items={item.items}
							key={groupKey}
							seenByIds={seenByIds}
							seenByNames={seenByNames}
						/>
					);
				})}
				<div className="h-6 w-full">
					{typingIndicatorParticipants.length > 0 ? (
						<TypingIndicator
							availableAIAgents={availableAIAgents}
							availableHumanAgents={availableHumanAgents}
							className="mt-2"
							participants={typingIndicatorParticipants}
						/>
					) : null}
				</div>
			</ConversationTimelineContainer>
		</PrimitiveConversationTimeline>
	);
}
