import { describe, expect, it } from "bun:test";
import {
	getHardLimitRollingWindowStart,
	isConversationAfterHardLimitCutoff,
} from "./usage";

describe("hard-limit usage helpers", () => {
	it("computes a rolling window start 30 days before now", () => {
		const now = new Date("2026-02-18T15:30:00.000Z");
		const windowStart = getHardLimitRollingWindowStart(now);

		expect(windowStart).toBe("2026-01-19T15:30:00.000Z");
	});

	it("treats the cutoff conversation itself as unlocked", () => {
		const cutoff = {
			id: "conv-0050",
			createdAt: "2026-02-18T15:30:00.000Z",
		};

		expect(
			isConversationAfterHardLimitCutoff(
				{
					id: cutoff.id,
					createdAt: cutoff.createdAt,
				},
				cutoff
			)
		).toBe(false);
	});

	it("locks conversations created after the cutoff timestamp", () => {
		const cutoff = {
			id: "conv-0050",
			createdAt: "2026-02-18T15:30:00.000Z",
		};

		expect(
			isConversationAfterHardLimitCutoff(
				{
					id: "conv-0051",
					createdAt: "2026-02-18T15:30:00.001Z",
				},
				cutoff
			)
		).toBe(true);
	});

	it("uses id ordering as a tie-breaker when timestamps are equal", () => {
		const cutoff = {
			id: "conv-0050",
			createdAt: "2026-02-18T15:30:00.000Z",
		};

		expect(
			isConversationAfterHardLimitCutoff(
				{
					id: "conv-0049",
					createdAt: cutoff.createdAt,
				},
				cutoff
			)
		).toBe(false);

		expect(
			isConversationAfterHardLimitCutoff(
				{
					id: "conv-0051",
					createdAt: cutoff.createdAt,
				},
				cutoff
			)
		).toBe(true);
	});

	it("never locks when no cutoff is available", () => {
		expect(
			isConversationAfterHardLimitCutoff(
				{
					id: "conv-0001",
					createdAt: "2026-02-18T15:30:00.000Z",
				},
				null
			)
		).toBe(false);
	});
});
