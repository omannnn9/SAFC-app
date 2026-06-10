// Server-side Stripe client + tier/interval -> price ID mapping.
// SECURITY: server-only. Never import from client code.
import Stripe from "stripe";
import type { Tier } from "@/lib/tiers";

function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const message = "Missing Stripe environment variable: STRIPE_SECRET_KEY";
    console.error(`[Stripe] ${message}`);
    throw new Error(message);
  }
  return new Stripe(key);
}

let _stripe: Stripe | undefined;

// Lazy proxy so importing this module never throws at build time
// (mirrors the pattern in src/integrations/supabase/client.server.ts).
export const stripe = new Proxy({} as Stripe, {
  get(_, prop, receiver) {
    if (!_stripe) _stripe = createStripeClient();
    return Reflect.get(_stripe, prop, receiver);
  },
});

export type BillingInterval = "monthly" | "annual";
export type PaidTier = Exclude<Tier, "free">;

const PRICE_ENV: Record<PaidTier, Record<BillingInterval, string>> = {
  basic: {
    monthly: "STRIPE_PRICE_BASIC_MONTHLY",
    annual: "STRIPE_PRICE_BASIC_ANNUAL",
  },
  premium: {
    monthly: "STRIPE_PRICE_PREMIUM_MONTHLY",
    annual: "STRIPE_PRICE_PREMIUM_ANNUAL",
  },
  founder: {
    monthly: "STRIPE_PRICE_FOUNDER_MONTHLY",
    annual: "STRIPE_PRICE_FOUNDER_ANNUAL",
  },
};

export function getPriceId(tier: PaidTier, interval: BillingInterval): string {
  const envKey = PRICE_ENV[tier][interval];
  const priceId = process.env[envKey];
  if (!priceId) throw new Error(`Missing Stripe price environment variable: ${envKey}`);
  return priceId;
}

/** Reverse lookup: price ID -> tier + interval (for webhook handling). */
export function tierForPriceId(priceId: string): { tier: PaidTier; interval: BillingInterval } | null {
  for (const tier of Object.keys(PRICE_ENV) as PaidTier[]) {
    for (const interval of ["monthly", "annual"] as BillingInterval[]) {
      if (process.env[PRICE_ENV[tier][interval]] === priceId) return { tier, interval };
    }
  }
  return null;
}
