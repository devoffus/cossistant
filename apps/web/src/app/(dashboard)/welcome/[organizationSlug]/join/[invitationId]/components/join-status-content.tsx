import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
	InvitationStatus,
	JoinAcceptanceState,
} from "../hooks/use-join-acceptance";

type JoinStatusContentProps = {
	state: JoinAcceptanceState;
	invitationStatus: InvitationStatus;
	errorMessage: string | null;
	invitedEmail: string | null;
	signedInEmail: string | null;
	canSwitchAccount: boolean;
	isAccepting: boolean;
	isRejecting: boolean;
	onAccept: () => void;
	onReject: () => void;
	onRetry: () => void;
	onSwitchAccount: () => void;
};

function getInvalidInvitationMessage(status: InvitationStatus): string {
	switch (status) {
		case "accepted":
			return "This invitation was already accepted.";
		case "rejected":
			return "This invitation was declined.";
		case "canceled":
			return "This invitation was canceled by your admin.";
		case "expired":
			return "This invitation has expired. Ask your admin to resend it.";
		case "not-found":
			return "This invitation link is invalid.";
		default:
			return "This invitation cannot be accepted.";
	}
}

export function JoinStatusContent({
	state,
	invitationStatus,
	errorMessage,
	invitedEmail,
	signedInEmail,
	canSwitchAccount,
	isAccepting,
	isRejecting,
	onAccept,
	onReject,
	onRetry,
	onSwitchAccount,
}: JoinStatusContentProps) {
	if (state === "idle") {
		return (
			<div className="space-y-4">
				<p className="text-sm">
					Accept this invitation to join your workspace, or decline it if it was
					sent by mistake.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button disabled={isAccepting || isRejecting} onClick={onAccept}>
						Accept invitation
					</Button>
					<Button
						disabled={isAccepting || isRejecting}
						onClick={onReject}
						variant="outline"
					>
						Decline invitation
					</Button>
				</div>
			</div>
		);
	}

	if (state === "accepting") {
		return (
			<div className="flex items-center gap-2 text-sm">
				<Loader2Icon className="size-4 animate-spin" />
				<span>Accepting your invitation...</span>
			</div>
		);
	}

	if (state === "rejecting") {
		return (
			<div className="flex items-center gap-2 text-sm">
				<Loader2Icon className="size-4 animate-spin" />
				<span>Declining your invitation...</span>
			</div>
		);
	}

	if (state === "success") {
		return (
			<div className="space-y-3">
				<p className="text-sm">You&apos;re in. Your access has been granted.</p>
				<Button asChild>
					<Link href="/select">Go to workspace</Link>
				</Button>
			</div>
		);
	}

	if (state === "rejected") {
		return (
			<div className="space-y-4">
				<p className="text-sm">You declined this invitation.</p>
				<div className="flex flex-wrap gap-2">
					<Button asChild>
						<Link href="/select">Go to workspace</Link>
					</Button>
				</div>
			</div>
		);
	}

	if (state === "wrong-account") {
		return (
			<div className="space-y-4">
				<p className="text-sm">
					This invitation belongs to a different account.
				</p>
				<p className="text-muted-foreground text-xs">
					{invitedEmail ? `Invited email: ${invitedEmail}. ` : ""}
					{signedInEmail ? `Signed in as: ${signedInEmail}.` : ""}
				</p>
				<div className="flex flex-wrap gap-2">
					{canSwitchAccount ? (
						<Button onClick={onSwitchAccount}>Switch account</Button>
					) : null}
					<Button asChild variant="outline">
						<Link href="/select">Go to workspace</Link>
					</Button>
				</div>
			</div>
		);
	}

	if (state === "invalid-invitation") {
		return (
			<div className="space-y-4">
				<p className="text-sm">
					{getInvalidInvitationMessage(invitationStatus)}
				</p>
				<p className="text-muted-foreground text-xs">
					If you still need access, ask your team admin to send a new
					invitation.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button asChild>
						<Link href="/select">Go to workspace</Link>
					</Button>
					{canSwitchAccount ? (
						<Button onClick={onSwitchAccount} variant="outline">
							Switch account
						</Button>
					) : null}
				</div>
			</div>
		);
	}

	if (state === "email-verification-required") {
		return (
			<div className="space-y-4">
				<p className="text-sm">
					Verify your email before accepting or declining this invitation.
				</p>
				<p className="text-muted-foreground text-xs">
					After verification, return to this page and try again.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button onClick={onRetry}>Try again</Button>
					<Button asChild variant="outline">
						<Link href="/select">Go to workspace</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-destructive text-sm">
				{errorMessage ??
					"Something went wrong while accepting your invitation."}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onRetry}>Try again</Button>
				<Button asChild variant="outline">
					<Link href="/select">Go to workspace</Link>
				</Button>
			</div>
		</div>
	);
}
