"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export type InvitationStatus =
	| "pending"
	| "accepted"
	| "rejected"
	| "canceled"
	| "expired"
	| "not-found";

type JoinResultCode =
	| "accepted"
	| "rejected"
	| "wrong-account"
	| "invalid-invitation"
	| "email-verification-required"
	| "error";

export type JoinAcceptanceState =
	| "idle"
	| "accepting"
	| "rejecting"
	| "success"
	| "rejected"
	| "wrong-account"
	| "invalid-invitation"
	| "email-verification-required"
	| "error";

type UseJoinAcceptanceParams = {
	organizationSlug: string;
	invitationId: string;
	invitationStatus: InvitationStatus;
	isInvitationValid: boolean;
	isSignedInEmailMatchingInvitation: boolean | null;
};

export function getInitialJoinState(params: {
	isInvitationValid: boolean;
	isSignedInEmailMatchingInvitation: boolean | null;
}): JoinAcceptanceState {
	if (!params.isInvitationValid) {
		return "invalid-invitation";
	}

	if (params.isSignedInEmailMatchingInvitation === false) {
		return "wrong-account";
	}

	return "idle";
}

function mapJoinResultCodeToState(code: JoinResultCode): JoinAcceptanceState {
	switch (code) {
		case "accepted":
			return "success";
		case "rejected":
			return "rejected";
		case "wrong-account":
			return "wrong-account";
		case "invalid-invitation":
			return "invalid-invitation";
		case "email-verification-required":
			return "email-verification-required";
		default:
			return "error";
	}
}

export function useJoinAcceptance({
	organizationSlug,
	invitationId,
	invitationStatus: _invitationStatus,
	isInvitationValid,
	isSignedInEmailMatchingInvitation,
}: UseJoinAcceptanceParams) {
	const trpc = useTRPC();
	const [state, setState] = useState<JoinAcceptanceState>(() =>
		getInitialJoinState({
			isInvitationValid,
			isSignedInEmailMatchingInvitation,
		})
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const { mutateAsync: acceptJoinInvitation, isPending: isAccepting } =
		useMutation(trpc.team.acceptJoinInvitation.mutationOptions());
	const { mutateAsync: rejectJoinInvitation, isPending: isRejecting } =
		useMutation(trpc.team.rejectJoinInvitation.mutationOptions());

	const applyResult = useCallback(
		(result: { resultCode: JoinResultCode; message?: string | null }) => {
			setState(mapJoinResultCodeToState(result.resultCode));
			setErrorMessage(result.message ?? null);
		},
		[]
	);

	const accept = useCallback(async () => {
		if (!isInvitationValid) {
			setState("invalid-invitation");
			return;
		}

		if (isSignedInEmailMatchingInvitation === false) {
			setState("wrong-account");
			return;
		}

		setState("accepting");
		setErrorMessage(null);

		try {
			const result = await acceptJoinInvitation({
				organizationSlug,
				invitationId,
			});
			applyResult(result);
		} catch (error) {
			setState("error");
			setErrorMessage(error instanceof Error ? error.message : null);
		}
	}, [
		acceptJoinInvitation,
		applyResult,
		invitationId,
		isInvitationValid,
		isSignedInEmailMatchingInvitation,
		organizationSlug,
	]);

	const reject = useCallback(async () => {
		if (!isInvitationValid) {
			setState("invalid-invitation");
			return;
		}

		if (isSignedInEmailMatchingInvitation === false) {
			setState("wrong-account");
			return;
		}

		setState("rejecting");
		setErrorMessage(null);

		try {
			const result = await rejectJoinInvitation({
				organizationSlug,
				invitationId,
			});
			applyResult(result);
		} catch (error) {
			setState("error");
			setErrorMessage(error instanceof Error ? error.message : null);
		}
	}, [
		applyResult,
		invitationId,
		isInvitationValid,
		isSignedInEmailMatchingInvitation,
		organizationSlug,
		rejectJoinInvitation,
	]);

	const retry = useCallback(() => {
		void accept();
	}, [accept]);

	return {
		state,
		errorMessage,
		accept,
		reject,
		retry,
		isAccepting,
		isRejecting,
	};
}
