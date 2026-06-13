import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedSupabase } from "@/lib/server-auth";
import { FOUNDER_CAP } from "@/lib/tiers";

const PaidTierEnum = z.enum(["basic", "premium", "founder"]);
const IntervalEnum = z.enum(["monthly", "annual"]);
const SUBSCRIPTIONS_COMING_SOON = true;

async function getAppOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const origin = req?.headers.get("origin");
  if (origin) return origin;
  const host = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host");
  if (!host) throw new Error("Unable to determine request origin");
  const proto =
    req?.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Get or create the Stripe customer for a user, persisting the ID on their profile. */
async function getOrCreateStripeCustomer(
  userId: string,
  email: string | undefined,
  fullName: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { stripe } = await import("@/lib/stripe.server");

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (profile?.stripe_customer_id) {
    // Guard against stale IDs (e.g. customer deleted in Stripe, or test/live mode switch)
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!existing.deleted) return profile.stripe_customer_id;
    } catch {
      // fall through and create a fresh customer
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: fullName ?? profile?.full_name ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  return customer.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ tier: PaidTierEnum, interval: IntervalEnum }).parse(input))
  .handler(async ({ data }) => {
    if (SUBSCRIPTIONS_COMING_SOON) {
      throw new Error(
        "Paid memberships are coming soon. No subscription payment can be started right now.",
      );
    }

    const { supabase, user, userId } = await requireAuthenticatedSupabase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { stripe, getPriceId } = await import("@/lib/stripe.server");

    // Founder cap: don't even start checkout if the Starting XI is full
    if (data.tier === "founder") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_founder", true);
      if ((count ?? 0) >= FOUNDER_CAP) {
        throw new Error(`Founding Member cap reached (${FOUNDER_CAP} Starting XI members)`);
      }
    }

    // One active subscription per member — changes go through the billing portal
    const { data: activeSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "stripe")
      .eq("status", "active")
      .maybeSingle();
    if (activeSub) {
      throw new Error(
        "You already have an active membership. Use Manage billing to change your plan.",
      );
    }

    const { data: me } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const customerId = await getOrCreateStripeCustomer(
      userId,
      user.email ?? undefined,
      me?.full_name ?? null,
    );
    const origin = await getAppOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(data.tier, data.interval), quantity: 1 }],
      success_url: `${origin}/membership?checkout=success`,
      cancel_url: `${origin}/membership?checkout=cancel`,
      allow_promotion_codes: true,
      branding_settings: { display_name: "SA FC" },
      metadata: { user_id: userId, tier: data.tier, interval: data.interval },
      subscription_data: {
        metadata: { user_id: userId, tier: data.tier, interval: data.interval },
      },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  });

export const createBillingPortalSession = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await requireAuthenticatedSupabase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { stripe } = await import("@/lib/stripe.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.stripe_customer_id) throw new Error("No billing account found for this member");

  const origin = await getAppOrigin();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/membership`,
  });
  return { url: session.url };
});

export const getMySubscription = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, userId } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, tier, status, interval, current_period_end, cancel_at_period_end, provider")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});
