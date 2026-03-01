import { sentinelClient } from "@better-auth/infra/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_API_BASE_URL
		? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth`
		: "http://localhost:8787/api/auth",
	fetchOptions: {
		credentials: "include" as const,
	},
	plugins: [organizationClient(), adminClient(), sentinelClient()],
});

// Alias requestPasswordReset as forgetPassword for backwards compatibility
export const forgetPassword = authClient.requestPasswordReset;
export const { signIn, signUp, signOut, resetPassword } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
