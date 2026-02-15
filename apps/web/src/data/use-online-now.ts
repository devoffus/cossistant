"use client";

import { useQuery } from "@tanstack/react-query";
import { queryTinybirdPipe, useTinybirdToken } from "@/lib/tinybird";

type OnlineEntity = {
	entity_id: string;
	entity_type: string;
	name: string;
	image: string;
	country_code: string | null;
	city: string | null;
	latitude: number | null;
	longitude: number | null;
	last_seen: string;
};

export function useOnlineNow({
	websiteSlug,
	minutes = 10,
	enabled = true,
}: {
	websiteSlug: string;
	minutes?: number;
	enabled?: boolean;
}) {
	const { data: tokenData } = useTinybirdToken(websiteSlug);

	return useQuery({
		queryKey: ["tinybird", "online-now", websiteSlug, minutes],
		queryFn: () => {
			const { token, host } = tokenData ?? {};
			if (!(token && host)) {
				throw new Error("Tinybird token not available");
			}
			return queryTinybirdPipe<OnlineEntity>(
				"online_now",
				{ minutes },
				token,
				host
			);
		},
		enabled: enabled && !!tokenData,
		staleTime: 30_000,
		refetchInterval: 30_000,
	});
}
