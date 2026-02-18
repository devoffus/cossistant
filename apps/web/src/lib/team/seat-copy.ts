type SeatCopyParams = {
	used: number;
	limit: number | null;
	reserved: number;
};

function pluralize(value: number, singular: string, plural = `${singular}s`) {
	return `${value} ${value === 1 ? singular : plural}`;
}

export function getTeamSeatPrimaryCopy({
	used,
	limit,
}: Pick<SeatCopyParams, "used" | "limit">): string {
	if (limit === null) {
		return `${pluralize(used, "seat")} used (unlimited)`;
	}

	return `${used} of ${pluralize(limit, "seat")} used`;
}

export function getTeamSeatSecondaryCopy({
	reserved,
}: Pick<SeatCopyParams, "reserved">): string {
	if (reserved <= 0) {
		return "No pending invites";
	}

	return `${pluralize(reserved, "pending invite")}`;
}

export function getTeamSeatCopy(params: SeatCopyParams) {
	return {
		primary: getTeamSeatPrimaryCopy(params),
		secondary: getTeamSeatSecondaryCopy(params),
	};
}
