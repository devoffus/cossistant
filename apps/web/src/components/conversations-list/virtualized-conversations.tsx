"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { CategoryHeader } from "@/components/conversations-list/category-header";
import { ConversationItem } from "@/components/conversations-list/conversation-item";
import type { ConversationHeader } from "@/contexts/inboxes";
import { PageContent } from "../ui/layout";
import {
	ANALYTICS_HEIGHT,
	HEADER_HEIGHT,
	ITEM_HEIGHT,
	type VirtualListItem,
} from "./types";
import { useConversationKeyboardNavigation } from "./use-conversation-keyboard-navigation";

type ConversationsListProps = {
	basePath: string;
	conversations: ConversationHeader[];
	showWaitingForReplyPill: boolean;
	websiteSlug: string;
	smartItems?: VirtualListItem[] | null;
	analyticsSlot?: ReactNode;
};

// Memoized conversation item with proper comparison
const VirtualConversationItem = memo(
	({
		conversation,
		href,
		websiteSlug,
		focused,
		showWaitingForReplyPill,
		isSmartMode,
		onMouseEnter,
	}: {
		conversation: ConversationHeader;
		href: string;
		websiteSlug: string;
		focused: boolean;
		showWaitingForReplyPill: boolean;
		isSmartMode: boolean;
		onMouseEnter: () => void;
	}) => (
		<ConversationItem
			focused={focused}
			header={conversation}
			href={href}
			isSmartMode={isSmartMode}
			setFocused={onMouseEnter}
			showWaitingForReplyPill={showWaitingForReplyPill}
			websiteSlug={websiteSlug}
		/>
	),
	(prevProps, nextProps) => {
		// Custom comparison to avoid unnecessary re-renders
		return (
			prevProps.conversation.id === nextProps.conversation.id &&
			prevProps.conversation.lastMessageAt ===
				nextProps.conversation.lastMessageAt &&
			prevProps.conversation.updatedAt === nextProps.conversation.updatedAt &&
			prevProps.conversation.lastSeenAt === nextProps.conversation.lastSeenAt &&
			prevProps.conversation.status === nextProps.conversation.status &&
			prevProps.conversation.deletedAt === nextProps.conversation.deletedAt &&
			prevProps.focused === nextProps.focused &&
			prevProps.isSmartMode === nextProps.isSmartMode &&
			prevProps.href === nextProps.href
		);
	}
);

VirtualConversationItem.displayName = "VirtualConversationItem";

// Memoized category header
const MemoizedCategoryHeader = memo(CategoryHeader);

export function VirtualizedConversations({
	basePath,
	conversations,
	showWaitingForReplyPill,
	websiteSlug,
	smartItems,
	analyticsSlot,
}: ConversationsListProps) {
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);

	const isSmartMode = smartItems != null;
	const items = isSmartMode ? smartItems : null;
	const itemCount = isSmartMode && items ? items.length : conversations.length;

	// Populate viewportRef with the actual scrollable element
	useEffect(() => {
		if (scrollAreaRef.current) {
			viewportRef.current = scrollAreaRef.current;
		}
	}, []);

	// Stable scroll element getter
	const getScrollElement = useCallback(() => scrollAreaRef.current, []);

	const { focusedIndex, handleMouseEnter } = useConversationKeyboardNavigation({
		conversations,
		items,
		basePath,
		parentRef: viewportRef,
		itemHeight: ITEM_HEIGHT,
		headerHeight: HEADER_HEIGHT,
		analyticsHeight: ANALYTICS_HEIGHT,
		enabled: true,
	});

	// Memoize estimateSize to prevent virtualizer recalculations
	const estimateSize = useCallback(
		(index: number) => {
			if (isSmartMode && items) {
				const item = items[index];
				if (item?.type === "header") {
					return HEADER_HEIGHT;
				}
				if (item?.type === "analytics") {
					return ANALYTICS_HEIGHT;
				}
				return ITEM_HEIGHT;
			}
			return ITEM_HEIGHT;
		},
		[isSmartMode, items]
	);

	// Use conversation IDs as keys to ensure proper React reconciliation when list reorders
	const getItemKey = useCallback(
		(index: number) => {
			if (isSmartMode && items) {
				const item = items[index];
				if (item?.type === "header") {
					return `header-${item.category}`;
				}
				if (item?.type === "analytics") {
					return "analytics";
				}
				return item?.conversation.id ?? index;
			}
			return conversations[index]?.id ?? index;
		},
		[isSmartMode, items, conversations]
	);

	const virtualizer = useVirtualizer({
		count: itemCount,
		getScrollElement,
		estimateSize,
		getItemKey,
		gap: 4,
		overscan: 4,
	});

	const virtualItems = virtualizer.getVirtualItems();
	const totalSize = virtualizer.getTotalSize();

	// Pre-compute mouse enter handlers to avoid creating functions in render
	const mouseEnterHandlers = useMemo(() => {
		const handlers = new Map<number, () => void>();
		for (const virtualItem of virtualItems) {
			handlers.set(virtualItem.index, () =>
				handleMouseEnter(virtualItem.index)
			);
		}
		return handlers;
	}, [virtualItems, handleMouseEnter]);

	return (
		<PageContent className="h-full pr-3 contain-strict" ref={scrollAreaRef}>
			<div
				style={{
					height: `${totalSize}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualItems.map((virtualItem) => {
					const mouseEnterHandler = mouseEnterHandlers.get(virtualItem.index);

					if (isSmartMode && items) {
						const item = items[virtualItem.index];

						if (!item) {
							return null;
						}

						if (item.type === "header") {
							return (
								<div
									key={`header-${item.category}`}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: `${virtualItem.size}px`,
										transform: `translateY(${virtualItem.start}px)`,
									}}
								>
									<MemoizedCategoryHeader
										category={item.category}
										count={item.count}
										label={item.label}
									/>
								</div>
							);
						}

						if (item.type === "analytics") {
							return (
								<div
									key="analytics"
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: `${virtualItem.size}px`,
										transform: `translateY(${virtualItem.start}px)`,
									}}
								>
									{analyticsSlot ?? null}
								</div>
							);
						}

						// It's a conversation item
						const conversation = item.conversation;
						const href = `${basePath}/${conversation.id}`;

						return (
							<div
								className="-ml-1"
								key={conversation.id}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: `${virtualItem.size}px`,
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								<VirtualConversationItem
									conversation={conversation}
									focused={focusedIndex === virtualItem.index}
									href={href}
									isSmartMode
									onMouseEnter={mouseEnterHandler ?? (() => {})}
									showWaitingForReplyPill={showWaitingForReplyPill}
									websiteSlug={websiteSlug}
								/>
							</div>
						);
					}

					// Classic mode - just conversations
					// biome-ignore lint/style/noNonNullAssertion: should never happen
					const conversation = conversations[virtualItem.index]!;
					const href = `${basePath}/${conversation.id}`;

					return (
						<div
							key={conversation.id}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start}px)`,
							}}
						>
							<VirtualConversationItem
								conversation={conversation}
								focused={focusedIndex === virtualItem.index}
								href={href}
								isSmartMode={false}
								onMouseEnter={mouseEnterHandler ?? (() => {})}
								showWaitingForReplyPill={showWaitingForReplyPill}
								websiteSlug={websiteSlug}
							/>
						</div>
					);
				})}
			</div>
		</PageContent>
	);
}
