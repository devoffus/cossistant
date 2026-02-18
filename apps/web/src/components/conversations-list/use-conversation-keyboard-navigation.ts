"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useConversationFocusStore } from "@/contexts/inboxes/conversation-focus-store";
import type { VirtualListItem } from "./types";

type UseConversationKeyboardNavigationProps = {
	conversations: Array<{ id: string; dashboardLocked?: boolean }>;
	items?: VirtualListItem[] | null;
	basePath: string;
	onLockedConversationEnter?: (conversationId: string) => void;
	parentRef: React.RefObject<HTMLDivElement | null>;
	itemHeight: number;
	headerHeight?: number;
	analyticsHeight?: number;
	enabled?: boolean;
};

export function useConversationKeyboardNavigation({
	conversations,
	items,
	basePath,
	onLockedConversationEnter,
	parentRef,
	itemHeight,
	headerHeight = 32,
	analyticsHeight = 32,
	enabled = true,
}: UseConversationKeyboardNavigationProps) {
	const router = useRouter();
	const lastInteractionRef = useRef<"keyboard" | "mouse">("keyboard");
	const hasInitializedRef = useRef(false);

	const isSmartMode = items != null && items.length > 0;
	const totalCount = isSmartMode ? items.length : conversations.length;

	const {
		focusedConversationId,
		shouldRestoreFocus,
		setFocusedConversationId,
		markFocusRestored,
	} = useConversationFocusStore();

	// Helper to check if an index is not a conversation
	const isHeaderIndex = useCallback(
		(index: number): boolean => {
			if (!isSmartMode) {
				return false;
			}

			return items[index]?.type !== "conversation";
		},
		[isSmartMode, items]
	);

	// Helper to get conversation ID at an index
	const getConversationAtIndex = useCallback(
		(index: number) => {
			if (isSmartMode) {
				const item = items[index];

				if (item?.type === "conversation") {
					return item.conversation;
				}

				return null;
			}

			return conversations[index] ?? null;
		},
		[isSmartMode, items, conversations]
	);

	// Find first non-header index
	const findFirstConversationIndex = useCallback((): number => {
		if (!isSmartMode) {
			return 0;
		}

		for (let i = 0; i < items.length; i++) {
			if (items[i]?.type === "conversation") {
				return i;
			}
		}

		return 0;
	}, [isSmartMode, items]);

	// Find last non-header index
	const findLastConversationIndex = useCallback((): number => {
		if (!isSmartMode) {
			return Math.max(0, conversations.length - 1);
		}

		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i]?.type === "conversation") {
				return i;
			}
		}

		return 0;
	}, [isSmartMode, items, conversations.length]);

	// Find next conversation index (skipping headers) with infinite loop support
	const findNextConversationIndex = useCallback(
		(currentIndex: number, direction: "up" | "down"): number => {
			const delta = direction === "up" ? -1 : 1;
			let newIndex = currentIndex + delta;

			while (newIndex >= 0 && newIndex < totalCount) {
				if (!isHeaderIndex(newIndex)) {
					return newIndex;
				}

				newIndex += delta;
			}

			// Wrap around: if going down and reached the end, go to first
			// If going up and reached the beginning, go to last
			if (direction === "down") {
				return findFirstConversationIndex();
			}

			return findLastConversationIndex();
		},
		[
			totalCount,
			isHeaderIndex,
			findFirstConversationIndex,
			findLastConversationIndex,
		]
	);

	// Initialize focus index - restore from store if we should
	const [focusedIndex, setFocusedIndex] = useState(() => {
		if (shouldRestoreFocus && focusedConversationId && totalCount > 0) {
			if (isSmartMode) {
				const index = items.findIndex(
					(item) =>
						item.type === "conversation" &&
						item.conversation.id === focusedConversationId
				);

				if (index !== -1) {
					return index;
				}
			} else {
				const index = conversations.findIndex(
					(c) => c.id === focusedConversationId
				);

				if (index !== -1) {
					return index;
				}
			}
		}

		return findFirstConversationIndex();
	});

	const getItemOffset = useCallback(
		(index: number): number => {
			if (!isSmartMode) {
				return index * itemHeight;
			}

			// Calculate offset considering variable heights
			let offset = 0;

			for (let i = 0; i < index; i++) {
				const item = items[i];
				const itemSize =
					item?.type === "header"
						? headerHeight
						: item?.type === "analytics"
							? analyticsHeight
							: itemHeight;
				offset += itemSize + 4; // 4px gap
			}

			return offset;
		},
		[isSmartMode, items, itemHeight, headerHeight, analyticsHeight]
	);

	const scrollToItem = useCallback(
		(index: number) => {
			if (!parentRef.current) {
				return;
			}

			const container = parentRef.current;
			const itemTop = getItemOffset(index);
			const currentItemHeight = isHeaderIndex(index)
				? items?.[index]?.type === "analytics"
					? analyticsHeight
					: headerHeight
				: itemHeight;
			const itemBottom = itemTop + currentItemHeight;
			const scrollTop = container.scrollTop;
			const scrollBottom = scrollTop + container.clientHeight;

			if (itemTop < scrollTop) {
				container.scrollTop = itemTop;
			} else if (itemBottom > scrollBottom) {
				container.scrollTop = itemBottom - container.clientHeight;
			}
		},
		[
			getItemOffset,
			isHeaderIndex,
			itemHeight,
			headerHeight,
			analyticsHeight,
			parentRef,
			items,
		]
	);

	const moveFocus = useCallback(
		(direction: "up" | "down") => {
			lastInteractionRef.current = "keyboard";
			setFocusedIndex((prevIndex) => {
				const newIndex = findNextConversationIndex(prevIndex, direction);

				if (newIndex !== prevIndex) {
					scrollToItem(newIndex);
				}

				return newIndex;
			});
		},
		[findNextConversationIndex, scrollToItem]
	);

	const navigateToConversation = useCallback(() => {
		const conversation = getConversationAtIndex(focusedIndex);

		if (!conversation) {
			return;
		}

		if (conversation.dashboardLocked) {
			onLockedConversationEnter?.(conversation.id);
			return;
		}

		// Store the focused conversation ID before navigating
		setFocusedConversationId(conversation.id);
		router.push(`${basePath}/${conversation.id}`);
	}, [
		focusedIndex,
		getConversationAtIndex,
		basePath,
		router,
		onLockedConversationEnter,
		setFocusedConversationId,
	]);

	const handleMouseEnter = useCallback(
		(index: number) => {
			// Don't allow focusing on headers
			if (isHeaderIndex(index)) {
				return;
			}

			lastInteractionRef.current = "mouse";
			setFocusedIndex(index);
		},
		[isHeaderIndex]
	);

	useHotkeys(
		["ArrowUp", "ArrowDown", "k", "j", "Enter"],
		(event, handler) => {
			if (!enabled) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			switch (handler.keys?.join("")) {
				case "arrowup":
				case "k":
					moveFocus("up");
					break;
				case "arrowdown":
				case "j":
					moveFocus("down");
					break;
				case "enter":
					navigateToConversation();
					break;
				default:
					break;
			}
		},
		{
			enabled,
			enableOnFormTags: false,
			enableOnContentEditable: false,
		},
		[moveFocus, navigateToConversation, enabled]
	);

	// Restore focus from store on mount if needed
	useEffect(() => {
		if (!enabled || totalCount === 0 || hasInitializedRef.current) {
			return;
		}

		if (shouldRestoreFocus && focusedConversationId) {
			let index = -1;

			if (isSmartMode) {
				index = items.findIndex(
					(item) =>
						item.type === "conversation" &&
						item.conversation.id === focusedConversationId
				);
			} else {
				index = conversations.findIndex((c) => c.id === focusedConversationId);
			}

			if (index !== -1) {
				setFocusedIndex(index);
				scrollToItem(index);
				lastInteractionRef.current = "keyboard";
				markFocusRestored();
			} else {
				const firstIndex = findFirstConversationIndex();
				setFocusedIndex(firstIndex);
				scrollToItem(firstIndex);
			}
		} else {
			const firstIndex = findFirstConversationIndex();
			scrollToItem(firstIndex);
		}

		hasInitializedRef.current = true;
	}, [
		enabled,
		totalCount,
		isSmartMode,
		items,
		conversations,
		focusedConversationId,
		shouldRestoreFocus,
		scrollToItem,
		markFocusRestored,
		findFirstConversationIndex,
	]);

	// Ensure focused index stays valid when list changes
	useEffect(() => {
		if (totalCount === 0) {
			return;
		}

		// Index out of bounds - clamp to last valid conversation
		if (focusedIndex >= totalCount) {
			let lastValidIndex = totalCount - 1;

			while (lastValidIndex >= 0 && isHeaderIndex(lastValidIndex)) {
				lastValidIndex--;
			}

			setFocusedIndex(Math.max(0, lastValidIndex));
			return;
		}

		// Index points to a header/analytics item (e.g. after list reorder) - find nearest conversation
		if (isHeaderIndex(focusedIndex)) {
			const nextConversation = findNextConversationIndex(focusedIndex, "down");

			// findNextConversationIndex wraps around, so the result is always a conversation
			setFocusedIndex(nextConversation);
		}
	}, [totalCount, focusedIndex, isHeaderIndex, findNextConversationIndex]);

	return {
		focusedIndex,
		handleMouseEnter,
		isKeyboardNavigation: lastInteractionRef.current === "keyboard",
	};
}
