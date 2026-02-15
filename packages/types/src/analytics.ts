/**
 * Shared satisfaction index calculation.
 *
 * Pure functions with zero dependencies — reusable in API, workers, and frontend.
 */

export const SATISFACTION_WEIGHTS = {
	rating: 0.4,
	sentiment: 0.25,
	responseTime: 0.2,
	resolution: 0.15,
} as const;

export const DEFAULT_SATISFACTION_SCORE = 50;

/**
 * Calculate response time score based on median response time.
 * Faster responses = higher score.
 */
export function calculateResponseTimeScore(
	medianSeconds: number | null
): number | null {
	if (medianSeconds === null) {
		return null;
	}

	if (medianSeconds <= 300) {
		return 100; // ≤5 min
	}
	if (medianSeconds <= 900) {
		return 85; // ≤15 min
	}
	if (medianSeconds <= 3600) {
		return 70; // ≤1 hour
	}
	if (medianSeconds <= 14_400) {
		return 50; // ≤4 hours
	}
	if (medianSeconds <= 86_400) {
		return 30; // ≤24 hours
	}
	return 10; // >24 hours
}

/**
 * Calculate composite satisfaction index from multiple signals.
 * Falls back to DEFAULT_SATISFACTION_SCORE when individual signals are missing.
 */
export function calculateSatisfactionIndex(scores: {
	ratingScore: number | null;
	sentimentScore: number | null;
	responseTimeScore: number | null;
	resolutionScore: number | null;
}): number {
	const rating = scores.ratingScore ?? DEFAULT_SATISFACTION_SCORE;
	const sentiment = scores.sentimentScore ?? DEFAULT_SATISFACTION_SCORE;
	const responseTime = scores.responseTimeScore ?? DEFAULT_SATISFACTION_SCORE;
	const resolution = scores.resolutionScore ?? DEFAULT_SATISFACTION_SCORE;

	return (
		SATISFACTION_WEIGHTS.rating * rating +
		SATISFACTION_WEIGHTS.sentiment * sentiment +
		SATISFACTION_WEIGHTS.responseTime * responseTime +
		SATISFACTION_WEIGHTS.resolution * resolution
	);
}
