import { describe, expect, it } from "bun:test";
import {
	type CustomerState,
	getSubscriptionForWebsite,
	getSubscriptionsForWebsite,
} from "./polar";

function buildState(
	subscriptions: CustomerState["activeSubscriptions"]
): CustomerState {
	return {
		customerId: "cus_123",
		activeSubscriptions: subscriptions,
		grantedBenefits: [],
	};
}

describe("plans/polar website subscription resolution", () => {
	it("prefers highest-tier plan when duplicates exist", () => {
		const state = buildState([
			{
				id: "sub_free",
				productId: "free-product",
				status: "active",
				metadata: { websiteId: "site_1" },
			},
			{
				id: "sub_hobby",
				productId: "b060ff1e-c2dd-4c02-a3e4-395d7cce84a0",
				status: "active",
				metadata: { websiteId: "site_1" },
			},
			{
				id: "sub_pro",
				productId: "c87aa036-2f0b-40da-9338-1a1fcc191543",
				status: "trialing",
				metadata: { websiteId: "site_1" },
			},
		]);

		const selected = getSubscriptionForWebsite(state, "site_1");
		expect(selected?.id).toBe("sub_pro");
	});

	it("prefers active over trialing for same plan tier", () => {
		const state = buildState([
			{
				id: "sub_trialing",
				productId: "c87aa036-2f0b-40da-9338-1a1fcc191543",
				status: "trialing",
				metadata: { websiteId: "site_1" },
			},
			{
				id: "sub_active",
				productId: "c87aa036-2f0b-40da-9338-1a1fcc191543",
				status: "active",
				metadata: { websiteId: "site_1" },
			},
		]);

		const selected = getSubscriptionForWebsite(state, "site_1");
		expect(selected?.id).toBe("sub_active");
	});

	it("returns only subscriptions matching metadata.websiteId", () => {
		const state = buildState([
			{
				id: "sub_other",
				productId: "c87aa036-2f0b-40da-9338-1a1fcc191543",
				status: "active",
				metadata: { websiteId: "site_2" },
			},
			{
				id: "sub_target",
				productId: "b060ff1e-c2dd-4c02-a3e4-395d7cce84a0",
				status: "active",
				metadata: { websiteId: "site_1" },
			},
		]);

		const filtered = getSubscriptionsForWebsite(state, "site_1");
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.id).toBe("sub_target");
	});
});
