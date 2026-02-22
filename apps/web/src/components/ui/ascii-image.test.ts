import { describe, expect, it } from "bun:test";
import {
	clampCharacterIndex,
	computeAsciiGridDimensions,
	getShimmerState,
	shouldAnimateAsciiMotion,
	shouldApplyShimmerTint,
} from "./ascii-image";

describe("ascii-image helpers", () => {
	it("keeps shimmer deterministic for same phase and cell", () => {
		const first = getShimmerState({
			cellIndex: 37,
			characterIndex: 12,
			motionIntensity: 0.8,
			phase: 42.5,
		});
		const second = getShimmerState({
			cellIndex: 37,
			characterIndex: 12,
			motionIntensity: 0.8,
			phase: 42.5,
		});

		expect(first).toEqual(second);
	});

	it("disables shimmer when motion intensity is zero", () => {
		const result = getShimmerState({
			cellIndex: 10,
			characterIndex: 4,
			motionIntensity: 0,
			phase: 12,
		});

		expect(result).toEqual({
			isActive: false,
			indexShift: 0,
		});
	});

	it("clamps character indexes to palette bounds", () => {
		expect(clampCharacterIndex(-3, 10)).toBe(0);
		expect(clampCharacterIndex(11, 10)).toBe(9);
		expect(clampCharacterIndex(4, 10)).toBe(4);
		expect(clampCharacterIndex(2, 0)).toBe(0);
	});

	it("caps animated cell count when motion mode is enabled", () => {
		const uncapped = computeAsciiGridDimensions({
			containerWidth: 4000,
			containerHeight: 2000,
			motionEnabled: false,
			resolution: 0.05,
		});
		const capped = computeAsciiGridDimensions({
			containerWidth: 4000,
			containerHeight: 2000,
			motionEnabled: true,
			resolution: 0.05,
		});

		expect(uncapped).not.toBeNull();
		expect(capped).not.toBeNull();
		expect((uncapped?.cols ?? 0) * (uncapped?.rows ?? 0)).toBeGreaterThan(
			20_000
		);
		expect((capped?.cols ?? 0) * (capped?.rows ?? 0)).toBeLessThanOrEqual(
			20_000
		);
	});

	it("tint application follows shimmer strength", () => {
		expect(
			shouldApplyShimmerTint({
				shimmerActive: true,
				shimmerTintColor: "#f97316",
				shimmerTintStrength: 0,
			})
		).toBe(false);

		expect(
			shouldApplyShimmerTint({
				shimmerActive: true,
				shimmerTintColor: "#f97316",
				shimmerTintStrength: 0.2,
			})
		).toBe(true);
	});

	it("disables animation when reduced motion is preferred", () => {
		expect(
			shouldAnimateAsciiMotion({
				isVisible: true,
				motionEnabled: true,
				prefersReducedMotion: true,
			})
		).toBe(false);
		expect(
			shouldAnimateAsciiMotion({
				isVisible: true,
				motionEnabled: true,
				prefersReducedMotion: false,
			})
		).toBe(true);
	});
});
