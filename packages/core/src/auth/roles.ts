export function parseCommaSeparatedRoles(
	value: string | null | undefined
): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

export function hasRole(
	value: string | null | undefined,
	role: string
): boolean {
	return parseCommaSeparatedRoles(value).includes(role.trim().toLowerCase());
}

export function hasAnyRole(
	value: string | null | undefined,
	roles: readonly string[]
): boolean {
	const normalizedRoles = parseCommaSeparatedRoles(value);
	return roles.some((role) => normalizedRoles.includes(role.toLowerCase()));
}
