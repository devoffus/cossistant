import type { Database } from "@api/db";
import { getVisitorPresenceProfiles } from "@api/db/queries/visitor";
import { trackPresence } from "@api/lib/tinybird-sdk";
import { waitForRedis } from "@api/redis";
import {
	PRESENCE_AWAY_WINDOW_MS,
	PRESENCE_ONLINE_WINDOW_MS,
} from "@cossistant/types";
import type Redis from "ioredis";

const PRESENCE_TTL_SECONDS = 60 * 60; // 1 hour
const ONLINE_WINDOW_MS = PRESENCE_ONLINE_WINDOW_MS;
const AWAY_WINDOW_MS = PRESENCE_AWAY_WINDOW_MS;

const VISITOR_SET_PREFIX = "presence:website";
const VISITOR_PROFILE_PREFIX = "presence:website";
const USER_SET_PREFIX = "presence:website";
const USER_PROFILE_PREFIX = "presence:website";

function visitorSetKey(websiteId: string): string {
	return `${VISITOR_SET_PREFIX}:${websiteId}:visitors`;
}

function visitorProfileKey(websiteId: string, visitorId: string): string {
	return `${VISITOR_PROFILE_PREFIX}:${websiteId}:visitor:${visitorId}`;
}

function userSetKey(websiteId: string): string {
	return `${USER_SET_PREFIX}:${websiteId}:users`;
}

function userProfileKey(websiteId: string, userId: string): string {
	return `${USER_PROFILE_PREFIX}:${websiteId}:user:${userId}`;
}

function toIsoTime(value: string | number | Date): string {
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "number") {
		return new Date(value).toISOString();
	}

	return new Date(value).toISOString();
}

function ensureTimestamp(value: string | number | Date): number {
	if (typeof value === "number") {
		return value;
	}

	return new Date(value).getTime();
}

export type PresenceStatus = "online" | "away";

export type VisitorPresenceEntry = {
	id: string;
	status: PresenceStatus;
	lastSeenAt: string;
	name: string | null;
	email: string | null;
	image: string | null;
	city: string | null;
	region: string | null;
	country: string | null;
	latitude: number | null;
	longitude: number | null;
	contactId: string | null;
};

export type VisitorPresenceResponse = {
	visitors: VisitorPresenceEntry[];
	totals: {
		online: number;
		away: number;
	};
};

type CachedVisitorProfile = {
	lastSeenAt?: string;
	name?: string;
	email?: string;
	image?: string;
	city?: string;
	region?: string;
	country?: string;
	latitude?: string;
	longitude?: string;
	profileHydrated?: string;
	contactId?: string;
};

function parseNumber(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function cachedProfileToEntry(
	profile: CachedVisitorProfile,
	id: string,
	status: PresenceStatus,
	lastSeenAt: string
): VisitorPresenceEntry {
	return {
		id,
		status,
		lastSeenAt,
		name: profile.name && profile.name.length > 0 ? profile.name : null,
		email: profile.email && profile.email.length > 0 ? profile.email : null,
		image: profile.image && profile.image.length > 0 ? profile.image : null,
		city: profile.city && profile.city.length > 0 ? profile.city : null,
		region: profile.region && profile.region.length > 0 ? profile.region : null,
		country:
			profile.country && profile.country.length > 0 ? profile.country : null,
		latitude: parseNumber(profile.latitude),
		longitude: parseNumber(profile.longitude),
		contactId:
			profile.contactId && profile.contactId.length > 0
				? profile.contactId
				: null,
	};
}

export function resolvePresenceStatus(lastSeenAtMs: number): PresenceStatus {
	const now = Date.now();

	if (lastSeenAtMs >= now - ONLINE_WINDOW_MS) {
		return "online";
	}

	return "away";
}

async function hydrateVisitorProfiles(
	redis: Redis,
	websiteId: string,
	visitorIds: string[],
	db: Database
): Promise<Map<string, CachedVisitorProfile>> {
	if (visitorIds.length === 0) {
		return new Map();
	}

	const rows = await getVisitorPresenceProfiles(db, {
		visitorIds,
		websiteId,
	});

	const pipeline = redis.pipeline();
	const profileMap = new Map<string, CachedVisitorProfile>();

	for (const row of rows) {
		const profile: CachedVisitorProfile = {
			lastSeenAt: row.lastSeenAt ?? undefined,
			name: row.contactName ?? undefined,
			email: row.contactEmail ?? undefined,
			image: row.contactImage ?? undefined,
			city: row.city ?? undefined,
			region: row.region ?? undefined,
			country: row.country ?? undefined,
			latitude:
				row.latitude === null || row.latitude === undefined
					? ""
					: String(row.latitude),
			longitude:
				row.longitude === null || row.longitude === undefined
					? ""
					: String(row.longitude),
			profileHydrated: "1",
			contactId: row.contactId ?? "",
		};

		const key = visitorProfileKey(websiteId, row.id);
		const values: Record<string, string> = {
			profileHydrated: "1",
			name: profile.name ?? "",
			email: profile.email ?? "",
			image: profile.image ?? "",
			city: profile.city ?? "",
			region: profile.region ?? "",
			country: profile.country ?? "",
			latitude: profile.latitude ?? "",
			longitude: profile.longitude ?? "",
			contactId: profile.contactId ?? "",
		};

		if (profile.lastSeenAt) {
			values.lastSeenAt = profile.lastSeenAt;
		}

		pipeline.hset(key, values);
		pipeline.expire(key, PRESENCE_TTL_SECONDS);
		profileMap.set(row.id, profile);
	}

	await pipeline.exec();
	return profileMap;
}

export async function markVisitorPresence(params: {
	websiteId: string;
	visitorId: string;
	lastSeenAt: string | number | Date;
	sessionId?: string;
	name?: string;
	image?: string;
	geo?: {
		countryCode?: string;
		city?: string;
		latitude?: number;
		longitude?: number;
	};
}): Promise<void> {
	try {
		const redis = await waitForRedis();
		const timestamp = ensureTimestamp(params.lastSeenAt);
		const iso = toIsoTime(timestamp);

		const setKey = visitorSetKey(params.websiteId);
		const profileKey = visitorProfileKey(params.websiteId, params.visitorId);

		const pipeline = redis.pipeline();
		pipeline.zadd(setKey, timestamp, params.visitorId);
		pipeline.expire(setKey, PRESENCE_TTL_SECONDS);
		pipeline.hset(profileKey, { lastSeenAt: iso });
		pipeline.expire(profileKey, PRESENCE_TTL_SECONDS);
		await pipeline.exec();

		trackPresence({
			website_id: params.websiteId,
			entity_id: params.visitorId,
			entity_type: "visitor",
			name: params.name,
			image: params.image,
			country_code: params.geo?.countryCode,
			city: params.geo?.city,
			latitude: params.geo?.latitude,
			longitude: params.geo?.longitude,
		});
	} catch (error) {
		console.error("[Presence] Failed to mark visitor presence", {
			websiteId: params.websiteId,
			visitorId: params.visitorId,
			error,
		});
	}
}

export async function markUserPresence(params: {
	websiteId: string;
	userId: string;
	lastSeenAt: string | number | Date;
	name?: string;
	image?: string;
	geo?: {
		countryCode?: string;
		city?: string;
		latitude?: number;
		longitude?: number;
	};
}): Promise<void> {
	try {
		const redis = await waitForRedis();
		const timestamp = ensureTimestamp(params.lastSeenAt);
		const iso = toIsoTime(timestamp);

		const setKey = userSetKey(params.websiteId);
		const profileKey = userProfileKey(params.websiteId, params.userId);

		const pipeline = redis.pipeline();
		pipeline.zadd(setKey, timestamp, params.userId);
		pipeline.expire(setKey, PRESENCE_TTL_SECONDS);
		pipeline.hset(profileKey, { lastSeenAt: iso });
		pipeline.expire(profileKey, PRESENCE_TTL_SECONDS);
		await pipeline.exec();

		trackPresence({
			website_id: params.websiteId,
			entity_id: params.userId,
			entity_type: "user",
			name: params.name,
			image: params.image,
			country_code: params.geo?.countryCode,
			city: params.geo?.city,
			latitude: params.geo?.latitude,
			longitude: params.geo?.longitude,
		});
	} catch (error) {
		console.error("[Presence] Failed to mark user presence", {
			websiteId: params.websiteId,
			userId: params.userId,
			error,
		});
	}
}

export async function listOnlineVisitors(
	db: Database,
	params: {
		websiteId: string;
		limit?: number;
	}
): Promise<VisitorPresenceResponse> {
	const redis = await waitForRedis();
	const limit = params.limit ?? 100;
	const setKey = visitorSetKey(params.websiteId);
	const cutoff = Date.now() - AWAY_WINDOW_MS;

	await redis.zremrangebyscore(setKey, 0, cutoff - 1);

	const rawEntries = (await redis.zrevrangebyscore(
		setKey,
		"+inf",
		cutoff,
		"WITHSCORES",
		"LIMIT",
		0,
		limit
	)) as string[];

	const entries: Array<{ id: string; lastSeenAtMs: number }> = [];

	for (let index = 0; index < rawEntries.length; index += 2) {
		const id = rawEntries[index];
		const score = Number(rawEntries[index + 1]);

		if (!id || Number.isNaN(score)) {
			continue;
		}

		entries.push({ id, lastSeenAtMs: score });
	}

	if (entries.length === 0) {
		return { visitors: [], totals: { online: 0, away: 0 } };
	}

	const pipeline = redis.pipeline();
	for (const entry of entries) {
		pipeline.hgetall(visitorProfileKey(params.websiteId, entry.id));
	}

	const cachedProfiles = await pipeline.exec();
	const profileResults = cachedProfiles ?? [];
	const profileMap = new Map<string, CachedVisitorProfile>();
	const missingProfiles: string[] = [];

	profileResults.forEach((result, idx) => {
		const [error, data] = result;
		if (error) {
			console.error("[Presence] Failed to load cached profile", {
				websiteId: params.websiteId,
				visitorId: entries[idx]?.id,
				error,
			});
			missingProfiles.push(entries[idx]?.id ?? "");
			return;
		}

		const profile = data as CachedVisitorProfile;

		if (!profile || Object.keys(profile).length === 0) {
			missingProfiles.push(entries[idx]?.id ?? "");
			return;
		}

		if (profile.profileHydrated !== "1") {
			missingProfiles.push(entries[idx]?.id ?? "");
		}

		profileMap.set(entries[idx]?.id ?? "", profile);
	});

	if (missingProfiles.length > 0) {
		const idsToHydrate = missingProfiles.filter((id) => id.length > 0);
		if (idsToHydrate.length > 0) {
			const hydrated = await hydrateVisitorProfiles(
				redis,
				params.websiteId,
				idsToHydrate,
				db
			);
			for (const [id, profile] of hydrated.entries()) {
				profileMap.set(id, profile);
			}
		}
	}

	const visitors: VisitorPresenceEntry[] = [];
	let online = 0;
	let away = 0;

	for (const entry of entries) {
		const lastSeenAt = toIsoTime(entry.lastSeenAtMs);
		const status = resolvePresenceStatus(entry.lastSeenAtMs);
		const cachedProfile = profileMap.get(entry.id) ?? {};
		const visitor = cachedProfileToEntry(
			cachedProfile,
			entry.id,
			status,
			lastSeenAt
		);

		if (status === "online") {
			online += 1;
		} else {
			away += 1;
		}

		visitors.push(visitor);
	}

	return {
		visitors,
		totals: {
			online,
			away,
		},
	};
}

export { ONLINE_WINDOW_MS, AWAY_WINDOW_MS };
