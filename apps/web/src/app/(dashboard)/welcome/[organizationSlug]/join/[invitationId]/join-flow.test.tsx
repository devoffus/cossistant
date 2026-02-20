import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JoinStatusContent } from "./components/join-status-content";
import { getInitialJoinState } from "./hooks/use-join-acceptance";

describe("join flow state initialization", () => {
	it("starts in invalid-invitation for invalid links", () => {
		expect(
			getInitialJoinState({
				isInvitationValid: false,
				isSignedInEmailMatchingInvitation: null,
			})
		).toBe("invalid-invitation");
	});

	it("starts in wrong-account when signed-in email doesn't match", () => {
		expect(
			getInitialJoinState({
				isInvitationValid: true,
				isSignedInEmailMatchingInvitation: false,
			})
		).toBe("wrong-account");
	});

	it("starts in idle when invitation can be acted on", () => {
		expect(
			getInitialJoinState({
				isInvitationValid: true,
				isSignedInEmailMatchingInvitation: true,
			})
		).toBe("idle");
	});
});

describe("join status content", () => {
	it("renders explicit accept and decline actions in idle state", () => {
		const html = renderToStaticMarkup(
			React.createElement(JoinStatusContent, {
				state: "idle",
				invitationStatus: "pending",
				errorMessage: null,
				invitedEmail: "alice@example.com",
				signedInEmail: "alice@example.com",
				canSwitchAccount: true,
				isAccepting: false,
				isRejecting: false,
				onAccept: () => {},
				onReject: () => {},
				onRetry: () => {},
				onSwitchAccount: () => {},
			})
		);

		expect(html).toContain("Accept invitation");
		expect(html).toContain("Decline invitation");
	});

	it("renders email verification message state", () => {
		const html = renderToStaticMarkup(
			React.createElement(JoinStatusContent, {
				state: "email-verification-required",
				invitationStatus: "pending",
				errorMessage: null,
				invitedEmail: "alice@example.com",
				signedInEmail: "alice@example.com",
				canSwitchAccount: true,
				isAccepting: false,
				isRejecting: false,
				onAccept: () => {},
				onReject: () => {},
				onRetry: () => {},
				onSwitchAccount: () => {},
			})
		);

		expect(html).toContain(
			"Verify your email before accepting or declining this invitation."
		);
	});
});
