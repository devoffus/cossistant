"use client";

import { useQuery } from "@tanstack/react-query";
import { queryTinybirdPipe, useTinybirdToken } from "@/lib/tinybird";

type PresenceLocation = {
	latitude: number;
	longitude: number;
	city: string | null;
	country_code: string | null;
	entity_count: number;
};

export function usePresenceLocations({
	websiteSlug,
	minutes = 5,
	enabled = true,
}: {
	websiteSlug: string;
	minutes?: number;
	enabled?: boolean;
}) {
	const { data: tokenData } = useTinybirdToken(websiteSlug);

	return useQuery({
		queryKey: ["tinybird", "presence-locations", websiteSlug, minutes],
		queryFn: () => {
			const { token, host } = tokenData ?? {};
			if (!(token && host)) {
				throw new Error("Tinybird token not available");
			}
			return queryTinybirdPipe<PresenceLocation>(
				"presence_locations",
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
