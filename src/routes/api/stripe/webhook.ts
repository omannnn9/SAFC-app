import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import type { Tier } from "@/lib/tiers";

type SubStatus = "active" | "cancelled" | "expired" | "pending";

function mapStatus(status: Stripe.Subscription.Status): SubStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      // incomplete, past_due, unpaid, paused
      return "pending";
  }
}

async function resolveUserId(sub: { metadata?: Record<string, string> | null; customer: string | Stripe.Customer | Stripe.DeletedCustomer | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const metaUserId = sub.metadata?.user_id;
  if (metaUserId) return metaUserId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { tierForPriceId } = await import("@/lib/stripe.server");

  const userId = await resolveUserId(sub);
  if (!userId) {
    console.error(`[stripe-webhook] No user found for subscription ${sub.id}`);
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const mapped = priceId ? tierForPriceId(priceId) : null;
  const tier: Tier | null = mapped?.tier ?? ((sub.metadata?.tier as Tier | undefined) ?? null);
  const interval = mapped?.interval ?? sub.metadata?.interval ?? null;
  const status = mapStatus(sub.status);
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;

  const { error: subError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: tier ?? "unknown",
      tier,
      status,
      interval,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      provider: "stripe",
      provider_ref: sub.id,
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (subError) {
    console.error(`[stripe-webhook] Failed to upsert subscription ${sub.id}: ${subError.message}`);
    return;
  }

  if (status === "active" && tier && tier !== "free") {
    const update =
      tier === "founder"
        ? { tier: "founder" as const, is_founder: true }
        : { tier, is_founder: false, founder_at: null };
    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", userId);
    if (error) console.error(`[stripe-webhook] Failed to set tier for ${userId}: ${error.message}`);
  } else if (status === "cancelled" || status === "expired") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tier: "free", is_founder: false, founder_at: null })
      .eq("id", userId);
    if (error) console.error(`[stripe-webhook] Failed to downgrade ${userId}: ${error.message}`);
  }
}

async function recordPayment(invoice: Stripe.Invoice, status: "succeeded" | "failed") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = await resolveUserId({ metadata: invoice.metadata, customer: invoice.customer });
  if (!userId) {
    console.error(`[stripe-webhook] No user found for invoice ${invoice.id}`);
    return;
  }

  // Idempotency: webhooks can be retried
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_ref", invoice.id)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabaseAdmin.from("payments").insert({
    user_id: userId,
    amount_cents: status === "succeeded" ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency?.toUpperCase() ?? "ZAR",
    status,
    provider: "stripe",
    provider_ref: invoice.id,
  });
  if (error) console.error(`[stripe-webhook] Failed to record payment ${invoice.id}: ${error.message}`);
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { stripe } = await import("@/lib/stripe.server");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET");
          return new Response("Webhook not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

        const payload = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
        } catch (err) {
          console.error(`[stripe-webhook] Signature verification failed: ${(err as Error).message}`);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session.mode === "subscription" && session.subscription) {
                const subId =
                  typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await syncSubscription(sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await syncSubscription(event.data.object);
              break;
            }
            case "invoice.paid": {
              await recordPayment(event.data.object, "succeeded");
              break;
            }
            case "invoice.payment_failed": {
              await recordPayment(event.data.object, "failed");
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error(`[stripe-webhook] Handler error for ${event.type}: ${(err as Error).message}`);
          return new Response("Webhook handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
