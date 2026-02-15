"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

const TOKEN_STALE_TIME = 480_000; // 8 min (refresh before 10-min JWT expiry)

export function useTinybirdToken(websiteSlug: string) {
	const trpc = useTRPC();
	return useQuery({
		...trpc.website.getTinybirdToken.queryOptions({ websiteSlug }),
		staleTime: TOKEN_STALE_TIME,
		refetchInterval: TOKEN_STALE_TIME,
	});
}

export async function queryTinybirdPipe<T>(
	pipe: string,
	params: Record<string, string | number>,
	token: string,
	host: string
): Promise<T[]> {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		searchParams.set(key, String(value));
	}
	const response = await fetch(
		`${host}/v0/pipes/${pipe}.json?${searchParams}`,
		{
			headers: { Authorization: `Bearer ${token}` },
		}
	);
	if (!response.ok) {
		throw new Error(`Tinybird query failed: ${response.status}`);
	}
	const result = await response.json();
	return result.data;
}
