import { describe, expect, it } from "bun:test";
import { isInviteResultSuccess, mapJoinErrorToResult } from "./team";

describe("team router invite result handling", () => {
	it("counts invitation outcomes as successful only for granted-access states", () => {
		expect(isInviteResultSuccess("invited")).toBe(true);
		expect(isInviteResultSuccess("added-to-team")).toBe(true);
		expect(isInviteResultSuccess("promoted-to-admin")).toBe(true);
		expect(isInviteResultSuccess("delivery-failed")).toBe(false);
		expect(isInviteResultSuccess("failed")).toBe(false);
	});
});

describe("team router join error mapping", () => {
	it("maps recipient mismatches to wrong-account", () => {
		expect(
			mapJoinErrorToResult(
				new Error("You are not the recipient of the invitation")
			).resultCode
		).toBe("wrong-account");
	});

	it("maps invitation-not-found style errors to invalid-invitation", () => {
		expect(
			mapJoinErrorToResult(new Error("INVITATION_NOT_FOUND")).resultCode
		).toBe("invalid-invitation");
	});

	it("maps email verification requirement errors", () => {
		expect(
			mapJoinErrorToResult(
				new Error(
					"Email verification required before accepting or rejecting invitation"
				)
			).resultCode
		).toBe("email-verification-required");
	});
});
