# AI Credits Metering (Polar)

This document describes how AI credit enforcement and subscription-backed credits work.

## Goals

- Enforce AI usage limits in-app before expensive generation work.
- Keep one subscription lineage per website (`metadata.websiteId`) so upgrades are in-place.
- Use Polar customer meter balance as the credit source of truth (including free plan websites).
- Keep usage ingest resilient with short cache/lock/backoff controls.

## Polar Setup

### Meter

Create this meter:

1. Name: `Cossistant AI Credits`
2. Slug/Key: `cossistant_ai_credits_v1`
3. Event filter: `ai_usage` (or your configured `AI_CREDIT_USAGE_EVENT_NAME`)
4. Aggregation: `sum(metadata.credits)`
5. Unit: `credits`

### Benefits

Attach all benefits to the same meter:

1. `Free AI Credits Monthly`: `50` units, rollover `off`
2. `Hobby AI Credits Monthly`: `1000` units, rollover per business choice
3. `Pro AI Credits Monthly`: `3000` units, rollover per business choice
4. Optional one-time top-up: `AI Credits Pack 500`

### Products

1. `Free`: recurring monthly, `$0`, attach `Free AI Credits Monthly`
2. `Hobby`: recurring paid, attach `Hobby AI Credits Monthly`
3. `Pro`: recurring paid, attach `Pro AI Credits Monthly`
4. Optional one-time top-up product for credit packs

## Environment Variables

API runtime:

- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRODUCT_ID_FREE_SANDBOX`
- `POLAR_PRODUCT_ID_FREE_PRODUCTION`
- `POLAR_PRODUCT_ID_HOBBY_SANDBOX` (default exists)
- `POLAR_PRODUCT_ID_HOBBY_PRODUCTION` (default exists)
- `POLAR_PRODUCT_ID_PRO_SANDBOX` (default exists)
- `POLAR_PRODUCT_ID_PRO_PRODUCTION` (default exists)
- `POLAR_AI_USAGE_METER_ID`
- `AI_CREDIT_USAGE_EVENT_NAME` (default: `ai_usage`)
- `AI_CREDIT_BALANCE_CACHE_TTL_SECONDS` (default: `15`)
- `AI_CREDIT_BALANCE_STALE_TTL_SECONDS` (default: `300`)
- `AI_CREDIT_INGEST_BACKOFF_SECONDS` (default: `30`)

## Free Plan Provisioning

- Every website should have one website-scoped subscription in Polar.
- On website creation, API attempts free subscription provisioning with metadata:
  - `metadata.websiteId=<websiteId>`
- Provisioning is lock-protected in Redis to avoid duplicate creates.
- Existing duplicate active subscriptions are normalized by keeping one winner (highest tier) and revoking extras.

Backfill existing data:

- Dry run: `bun run billing:backfill-free-subscriptions`
- Apply: `bun run billing:backfill-free-subscriptions --apply`

The script:

1. Creates missing free subscriptions for active websites.
2. Normalizes duplicate active subscriptions to one winner.
3. Logs missing Polar customer invariants.

## Upgrade / Downgrade Flow

`plan.createCheckout` now uses update-first behavior:

1. Resolve website subscription by `metadata.websiteId`.
2. If found, call `subscriptions.update` with:
   - `productId=<targetPlanProductId>`
   - `prorationBehavior="invoice"`
3. If update succeeds: return `{ mode: "updated" }` (no checkout redirect).
4. If update fails with payment-readiness errors: fallback to checkout and return `{ mode: "checkout", checkoutUrl }`.
5. If update fails with config/product/not-found errors: return explicit server error.

Frontend modal handles both modes:

- `updated`: show success and refresh plan data.
- `checkout`: redirect to Polar checkout URL.

## Credit Enforcement and Charging

Defined in `/Users/anthonyriera/code/cossistant-monorepo/apps/api/src/lib/ai-credits/config.ts`.

- Base run: `1`
- High-end model surcharge: `+1`
- Tool billing: first `2` billable calls included, then `+0.5` per extra call
- Excluded tools: `sendMessage`, `sendPrivateMessage`, `aiDecision`

Guard behavior:

1. If meter config missing/not found: fail closed.
2. If transient Polar errors: outage mode allows only outage-allowlisted models.
3. If balance below minimum run credits: skip generation.

## Usage Event Ingestion

After generation attempt, API ingests event:

- Name: `AI_CREDIT_USAGE_EVENT_NAME`
- External customer ID: organization ID
- Metered metadata: `credits`
- Trace metadata includes model/run/tool breakdown

Ingest write failures are non-fatal to chat flow and use short Redis backoff to avoid hammering Polar.

## Polar References

- [Update Subscription API](https://docs.polar.sh/api-reference/subscriptions/update)
- [Proration for Subscription Changes](https://docs.polar.sh/guides/proration-for-subscription-changes)
- [Subscription Upgrades Guide](https://docs.polar.sh/guides/subscription-upgrades)
- [Create Subscription API](https://docs.polar.sh/api-reference/subscriptions/create)
- [Credits System](https://docs.polar.sh/features/usage-based-billing/credits)
