"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FakeWidgetMouseCursorProps = {
	isVisible: boolean;
	targetElementRef: React.RefObject<HTMLElement | null>;
	onClick: () => void;
	className?: string;
};

/**
 * Mouse cursor component specifically for the fake support widget.
 * Calculates positions relative to the widget container.
 */
export function FakeWidgetMouseCursor({
	isVisible,
	targetElementRef,
	onClick,
	className,
}: FakeWidgetMouseCursorProps) {
	const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
	const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
	const cursorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isVisible) {
			return;
		}

		let timeoutId: NodeJS.Timeout | undefined;
		let retryCount = 0;
		const maxRetries = 10;

		const updatePositions = () => {
			// Clear any existing timeout
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			if (!targetElementRef.current) {
				// Retry if element not found yet
				if (retryCount < maxRetries) {
					retryCount++;
					timeoutId = setTimeout(updatePositions, 50);
				}
				return;
			}

			const targetButton = targetElementRef.current;

			// Find the stable fake widget container wrapper.
			const widgetContainer = targetButton.closest(
				"[data-fake-widget-container='true']"
			) as HTMLElement | null;

			if (!widgetContainer) {
				// Retry if container not found
				if (retryCount < maxRetries) {
					retryCount++;
					timeoutId = setTimeout(updatePositions, 50);
				}
				return;
			}

			const containerRect = widgetContainer.getBoundingClientRect();
			const targetRect = targetButton.getBoundingClientRect();

			// Only proceed if target element has valid dimensions
			if (targetRect.width === 0 || targetRect.height === 0) {
				if (retryCount < maxRetries) {
					retryCount++;
					timeoutId = setTimeout(updatePositions, 50);
				}
				return;
			}

			// Calculate target position relative to widget container
			// Account for cursor size (24px = size-6) to center the cursor properly
			const cursorSize = 24;
			const targetX =
				targetRect.left -
				containerRect.left +
				targetRect.width / 2 -
				cursorSize / 2;
			const targetY =
				targetRect.top -
				containerRect.top +
				targetRect.height / 2 -
				cursorSize / 2;

			// Start from top-right corner (slightly outside viewport)
			const startX = containerRect.width + 20;
			const startY = 80;

			setStartPosition({ x: startX, y: startY });
			setTargetPosition({ x: targetX, y: targetY });
		};

		// Use requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			requestAnimationFrame(updatePositions);
		});

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [isVisible, targetElementRef]);

	// Don't render until positions are calculated (prevents flash of cursor in wrong position)
	if (!isVisible) {
		return null;
	}

	// Wait for positions to be calculated before rendering
	if (startPosition.x === 0 && targetPosition.x === 0) {
		return null;
	}

	return (
		<motion.div
			animate={{
				x: targetPosition.x - startPosition.x,
				y: targetPosition.y - startPosition.y,
				scale: [1, 0.85, 1],
			}}
			className={cn(
				"pointer-events-none absolute z-50 size-6 rounded-full border-2 border-foreground/90 bg-primary shadow-xl",
				className
			)}
			initial={{ scale: 1, opacity: 1 }}
			onAnimationComplete={() => {
				// Trigger click after animation completes
				onClick();
			}}
			ref={cursorRef}
			style={{
				left: startPosition.x,
				top: startPosition.y,
				willChange: "transform",
			}}
			transition={{
				duration: 0.9,
				ease: [0.25, 0.1, 0.25, 1],
				scale: {
					times: [0, 0.85, 1],
					duration: 0.9,
				},
			}}
		>
			{/* Cursor pointer - make it more visible */}
			<div className="absolute top-1 left-1 size-2 rounded-full bg-foreground" />
		</motion.div>
	);
}
