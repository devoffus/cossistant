import {
	getContactCount,
	getRollingWindowConversationCount,
	getRollingWindowMessageCount,
	getTeamMemberCount,
	HARD_LIMIT_ROLLING_WINDOW_DAYS,
} from "@api/db/queries/usage";
import { getWebsiteBySlugWithAccess } from "@api/db/queries/website";
import { member } from "@api/db/schema/auth";
import { website } from "@api/db/schema/website";
import { env } from "@api/env";
import {
	getDashboardConversationLockCutoff,
	resolveDashboardHardLimitPolicy,
} from "@api/lib/hard-limits/dashboard";
import { getPlanForWebsite } from "@api/lib/plans/access";
import { getPlanConfig, type PlanName } from "@api/lib/plans/config";
import {
	EARLY_BIRD_DISCOUNT_ID,
	getDiscountInfo,
} from "@api/lib/plans/discount";
import {
	getCustomerByOrganizationId,
	getCustomerState,
	getPlanFromCustomerState,
	getSubscriptionForWebsite,
} from "@api/lib/plans/polar";
import polarClient from "@api/lib/polar";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const planRouter = createTRPCRouter({
	getPublicDiscountInfo: publicProcedure
		.input(
			z.object({
				discountId: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			// Default to early bird discount if not specified
			const discountId = input.discountId ?? EARLY_BIRD_DISCOUNT_ID;

			try {
				const discount = await getDiscountInfo(discountId);
				return discount;
			} catch (error) {
				return null;
			}
		}),
	getPlanInfo: protectedProcedure
		.input(
			z.object({
				websiteSlug: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			const websiteData = await getWebsiteBySlugWithAccess(ctx.db, {
				userId: ctx.user.id,
				websiteSlug: input.websiteSlug,
			});

			if (!websiteData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Website not found or access denied",
				});
			}

			// Get plan information
			const planInfo = await getPlanForWebsite(websiteData);

			// Get usage counts
			if (!websiteData.teamId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Website must have a team ID",
				});
			}

			const hardLimitPolicy = resolveDashboardHardLimitPolicy(planInfo);

			const [
				messages,
				conversations,
				contacts,
				teamMembers,
				conversationLockCutoff,
			] = await Promise.all([
				getRollingWindowMessageCount(ctx.db, {
					websiteId: websiteData.id,
					organizationId: websiteData.organizationId,
					windowStart: hardLimitPolicy.windowStart,
				}),
				getRollingWindowConversationCount(ctx.db, {
					websiteId: websiteData.id,
					organizationId: websiteData.organizationId,
					windowStart: hardLimitPolicy.windowStart,
				}),
				getContactCount(ctx.db, {
					websiteId: websiteData.id,
					organizationId: websiteData.organizationId,
				}),
				getTeamMemberCount(ctx.db, {
					teamId: websiteData.teamId,
					organizationId: websiteData.organizationId,
				}),
				getDashboardConversationLockCutoff(ctx.db, {
					websiteId: websiteData.id,
					organizationId: websiteData.organizationId,
					policy: hardLimitPolicy,
				}),
			]);

			const messagesReached =
				hardLimitPolicy.messageLimit !== null
					? messages >= hardLimitPolicy.messageLimit
					: false;
			const conversationsReached =
				hardLimitPolicy.conversationLimit !== null
					? conversations >= hardLimitPolicy.conversationLimit
					: false;

			return {
				plan: {
					name: planInfo.planName,
					displayName: planInfo.displayName,
					price: planInfo.price,
					features: planInfo.features,
				},
				usage: {
					messages,
					contacts,
					conversations,
					teamMembers,
				},
				hardLimitStatus: {
					rollingWindowDays: HARD_LIMIT_ROLLING_WINDOW_DAYS,
					windowStart: hardLimitPolicy.windowStart,
					enforced: hardLimitPolicy.enforced,
					unavailableReason: hardLimitPolicy.unavailableReason,
					messages: {
						limit: hardLimitPolicy.messageLimit,
						used: messages,
						reached: messagesReached,
					},
					conversations: {
						limit: hardLimitPolicy.conversationLimit,
						used: conversations,
						reached: conversationsReached,
						lockCutoff: conversationLockCutoff
							? {
									createdAt: conversationLockCutoff.createdAt,
									id: conversationLockCutoff.id,
								}
							: null,
					},
				},
			};
		}),
	getPlansForOrganization: protectedProcedure
		.input(
			z.object({
				organizationId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			// Verify user has access to this organization
			const [membership] = await ctx.db
				.select()
				.from(member)
				.where(
					and(
						eq(member.userId, ctx.user.id),
						eq(member.organizationId, input.organizationId)
					)
				)
				.limit(1);

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this organization",
				});
			}

			// Get all websites for this organization
			const websites = await ctx.db
				.select({
					id: website.id,
					organizationId: website.organizationId,
				})
				.from(website)
				.where(
					and(
						eq(website.organizationId, input.organizationId),
						isNull(website.deletedAt)
					)
				);

			if (websites.length === 0) {
				return [];
			}

			// Get customer state once for the organization
			const customer = await getCustomerByOrganizationId(input.organizationId);

			if (!customer) {
				// No customer means all websites are on free plan
				const freePlan = getPlanConfig("free");
				return websites.map((site) => ({
					websiteId: site.id,
					planName: "free" as PlanName,
					displayName: freePlan.displayName,
				}));
			}

			const customerState = await getCustomerState(customer.id);

			// Map each website to its plan
			const planPromises = websites.map(async (site) => {
				const subscription = getSubscriptionForWebsite(customerState, site.id);

				if (subscription) {
					// Create a temporary customer state with just this subscription
					const subscriptionCustomerState = {
						customerId: customerState?.customerId ?? "",
						activeSubscriptions: [subscription],
						grantedBenefits: customerState?.grantedBenefits ?? [],
					};

					// Get plan from subscription
					const planName = await getPlanFromCustomerState(
						subscriptionCustomerState
					);
					const finalPlan = planName ?? "free";
					const config = getPlanConfig(finalPlan);
					return {
						websiteId: site.id,
						planName: finalPlan,
						displayName: config.displayName,
					};
				}

				// Default to free plan
				const freePlan = getPlanConfig("free");
				return {
					websiteId: site.id,
					planName: "free" as PlanName,
					displayName: freePlan.displayName,
				};
			});

			return Promise.all(planPromises);
		}),
	getDiscountInfo: protectedProcedure
		.input(
			z.object({
				discountId: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			// Default to early bird discount if not specified
			const discountId = input.discountId ?? EARLY_BIRD_DISCOUNT_ID;

			try {
				const discount = await getDiscountInfo(discountId);

				return discount;
			} catch (error) {
				return null;
			}
		}),
	createCheckout: protectedProcedure
		.input(
			z.object({
				websiteSlug: z.string(),
				targetPlan: z.enum(["free", "hobby", "pro"]),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { targetPlan } = input;

			const websiteData = await getWebsiteBySlugWithAccess(ctx.db, {
				userId: ctx.user.id,
				websiteSlug: input.websiteSlug,
			});

			if (!websiteData) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Website not found or access denied",
				});
			}

			// Get target plan config
			const targetPlanConfig = getPlanConfig(targetPlan as PlanName);

			if (!targetPlanConfig.polarProductId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Plan ${targetPlan} does not have a Polar product ID configured`,
				});
			}

			// Get customer by organization ID (customer should exist from organization creation)
			const customer = await getCustomerByOrganizationId(
				websiteData.organizationId
			);

			if (!customer) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Customer not found. Please contact support.",
				});
			}

			// Create checkout session
			try {
				const baseUrl = env.PUBLIC_APP_URL || "http://localhost:3000";
				const returnPath = `/${input.websiteSlug}/settings/plan`;

				const checkoutParams: {
					products: string[];
					externalCustomerId: string;
					metadata: { websiteId: string };
					successUrl: string;
					failureUrl: string;
				} = {
					products: [targetPlanConfig.polarProductId],
					externalCustomerId: websiteData.organizationId,
					metadata: {
						websiteId: websiteData.id,
					},
					successUrl: `${baseUrl}${returnPath}?checkout_success=true`,
					failureUrl: `${baseUrl}${returnPath}?checkout_error=true`,
				};

				const checkout = await polarClient.checkouts.create(checkoutParams);

				return {
					checkoutUrl: checkout.url,
				};
			} catch (error) {
				console.error("Error creating checkout:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create checkout session",
				});
			}
		}),
});
