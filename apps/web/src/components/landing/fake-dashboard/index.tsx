"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useViewportVisibility } from "@/hooks/use-viewport-visibility";
import { cn } from "@/lib/utils";
import { useLandingAnimationStore } from "@/stores/landing-animation-store";
import { FakeConversation } from "./fake-conversation";
import { useFakeConversation } from "./fake-conversation/use-fake-conversation";
import { FakeInbox } from "./fake-inbox";
import { useFakeInbox } from "./fake-inbox/use-fake-inbox";
import { FakeCentralContainer } from "./fake-layout";
import { FakeNavigationTopbar } from "./fake-navigation-topbar";
import "./fake-dashboard.css";

export function FakeDashboard({ className }: { className?: string }) {
	const currentView = useLandingAnimationStore((state) => state.currentView);
	const isPlaying = useLandingAnimationStore((state) => state.isPlaying);
	const isRestarting = useLandingAnimationStore((state) => state.isRestarting);
	const onAnimationComplete = useLandingAnimationStore(
		(state) => state.onAnimationComplete
	);
	const play = useLandingAnimationStore((state) => state.play);
	const pause = useLandingAnimationStore((state) => state.pause);
	const reset = useLandingAnimationStore((state) => state.reset);
	const selectView = useLandingAnimationStore((state) => state.selectView);
	const previousViewRef = useRef<typeof currentView>(currentView);
	const [showMouseCursor, setShowMouseCursor] = useState(false);
	const [dashboardRef, isVisible] = useViewportVisibility<HTMLDivElement>({
		threshold: 0.1,
		rootMargin: "50px",
	});

	useEffect(() => {
		if (!isVisible && isPlaying) {
			pause();
		} else if (isVisible && !isPlaying && currentView !== null) {
			play();
		}
	}, [isVisible, isPlaying, pause, play, currentView]);

	useEffect(() => {
		reset();
		const timeout = setTimeout(() => {
			play();
		}, 500);
		return () => clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleMouseClick = useCallback(() => {
		setShowMouseCursor(false);
		setTimeout(() => {
			selectView("conversation");
		}, 100);
	}, [selectView]);

	const handleShowMouseCursor = useCallback(() => {
		setShowMouseCursor(true);
	}, []);

	const inboxHook = useFakeInbox({
		isPlaying: isPlaying && currentView === "inbox",
		onComplete: undefined,
		onShowMouseCursor:
			currentView === "inbox" ? handleShowMouseCursor : undefined,
	});

	const conversationHook = useFakeConversation({
		isPlaying: isPlaying && currentView === "conversation",
		onComplete:
			currentView === "conversation" ? onAnimationComplete : undefined,
		onConversationResolved: inboxHook.markConversationResolved,
		initialMessages: inboxHook.inboxMessages,
	});

	useEffect(() => {
		if (!isRestarting) {
			return;
		}

		inboxHook.resetDemoData();
		conversationHook.resetDemoData();
		setShowMouseCursor(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isRestarting]);

	useEffect(() => {
		if (
			previousViewRef.current !== null &&
			previousViewRef.current !== currentView
		) {
			setShowMouseCursor(false);
		}

		previousViewRef.current = currentView;
	}, [currentView]);

	return (
		<div
			className={cn(
				"@container relative flex h-full w-full flex-col overflow-hidden bg-background-100 dark:bg-background",
				className
			)}
			ref={dashboardRef}
		>
			<FakeNavigationTopbar />
			<FakeCentralContainer>
				{currentView === "inbox" ? (
					<FakeInbox
						conversations={inboxHook.conversations}
						onMouseClick={handleMouseClick}
						showMouseCursor={showMouseCursor}
						typingActors={inboxHook.typingActors}
					/>
				) : (
					<FakeConversation
						conversation={conversationHook.conversation}
						timeline={conversationHook.timelineItems}
						typingActors={conversationHook.typingActors}
						visitor={conversationHook.visitor}
					/>
				)}
			</FakeCentralContainer>
		</div>
	);
}
