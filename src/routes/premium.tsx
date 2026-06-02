import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Bafana Premium Pass" }] }),
  component: PremiumPage,
});

const PERKS = [
  "Exclusive news & behind-the-scenes content",
  "Early access to match tickets",
  "Premium digital membership card",
  "Priority push notifications",
  "Premium badge on your profile",
  "Exclusive interviews & video access",
];

function PremiumPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubscribe = async () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/premium" } });
      return;
    }
    setLoading(true);
    // NOTE: Stripe checkout not yet wired. For now, activate membership directly.
    // Replace with a server route that creates a Stripe Checkout Session.
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { error } = await supabase
      .from("profiles")
      .update({ is_premium: true, premium_until: periodEnd.toISOString() })
      .eq("id", user.id);

    if (!error) {
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan: "bafana_premium_pass",
        status: "active",
        current_period_end: periodEnd.toISOString(),
        provider: "manual",
      });
      await supabase.from("payments").insert({
        user_id: user.id,
        amount_cents: 9900,
        currency: "ZAR",
        status: "paid",
        provider: "manual",
      });
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Welcome to Bafana Premium!");
    navigate({ to: "/profile" });
  };

  const isPremium = profile?.is_premium;

  return (
    <PageContainer>
      <AppHeader title="Premium" />

      <section className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-[var(--sa-gold)]/15 via-black to-black p-6 shadow-[var(--shadow-glow-gold)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary backdrop-blur">
            <Crown className="h-3 w-3" /> Bafana Premium Pass
          </div>
          <h1 className="mt-4 font-display text-4xl font-black leading-[0.95] tracking-tight">
            Closer to the <span className="text-primary">action.</span>
          </h1>
          <p className="mt-2 text-sm text-foreground/80">
            Exclusive access for the most committed supporters of Bafana Bafana.
          </p>

          <div className="mt-6 flex items-end gap-2">
            <div className="font-display text-5xl font-black">R99</div>
            <div className="pb-1 text-xs text-muted-foreground">/ month</div>
          </div>
        </div>
      </section>

      <section className="mt-6 px-4">
        <ul className="space-y-2 rounded-2xl border border-border bg-surface/60 p-2">
          {PERKS.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm"
            >
              <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sticky bottom-20 mt-6 px-4">
        <button
          onClick={onSubscribe}
          disabled={loading || isPremium}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow-gold)] transition disabled:opacity-60"
        >
          {isPremium ? (
            <>
              <Crown className="h-4 w-4" /> You're Premium
            </>
          ) : loading ? (
            "Activating…"
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Get Premium Pass
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Cancel anytime. Secure payment.
        </p>
      </section>
    </PageContainer>
  );
}
