import { useCallback, useEffect, useRef } from "react";
import { useAnimationScheduler } from "@/hooks/use-animation-scheduler";

type UseFakeSupportWidgetHomeProps = {
	isPlaying: boolean;
	onComplete?: () => void;
	onShowMouseCursor?: () => void;
};

/**
 * Hook to manage the home page animation state.
 * Shows mouse cursor after a delay.
 */
export function useFakeSupportWidgetHome({
	isPlaying,
	onComplete,
	onShowMouseCursor,
}: UseFakeSupportWidgetHomeProps) {
	const hasScheduledRef = useRef(false);
	const scheduleRef = useRef<
		((timeMs: number, callback: () => void) => () => void) | null
	>(null);
	const onShowMouseCursorRef = useRef(onShowMouseCursor);

	// Keep refs updated
	useEffect(() => {
		onShowMouseCursorRef.current = onShowMouseCursor;
	}, [onShowMouseCursor]);

	const { schedule, reset: resetScheduler } = useAnimationScheduler({
		isPlaying,
		onComplete,
	});

	// Keep schedule ref updated
	scheduleRef.current = schedule;
	useEffect(() => {
		scheduleRef.current = schedule;
	}, [schedule]);

	const resetDemoData = useCallback(() => {
		resetScheduler();
		hasScheduledRef.current = false;
	}, [resetScheduler]);

	// Schedule the mouse cursor animation
	useEffect(() => {
		// Only schedule when isPlaying is true and we haven't scheduled yet
		if (!isPlaying || hasScheduledRef.current) {
			return;
		}

		const scheduleTasks = () => {
			const currentSchedule = scheduleRef.current;
			if (!currentSchedule) {
				// Schedule ref not ready yet, retry on next tick
				setTimeout(scheduleTasks, 10);
				return;
			}

			// Mark as scheduled immediately to prevent duplicate scheduling
			hasScheduledRef.current = true;

			// Show mouse cursor shortly after entering the home view.
			currentSchedule(450, () => {
				if (onShowMouseCursorRef.current) {
					onShowMouseCursorRef.current();
				}
			});
		};

		// Start scheduling (with retry if schedule not ready)
		scheduleTasks();
	}, [isPlaying]);

	return {
		resetDemoData,
	};
}
