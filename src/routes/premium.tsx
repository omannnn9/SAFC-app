import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Crown, Sparkles, Lock } from "lucide-react";
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
        <div className="noise relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-[oklch(0.2_0.06_85)] via-black to-black p-6 shadow-[var(--shadow-glow-gold)]">
          {/* breathing glow */}
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl breathe" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[var(--sa-green)]/20 blur-3xl breathe" />
          {/* shimmer border */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl">
            <div className="absolute inset-x-0 -top-px h-px shimmer-gold opacity-80" />
            <div className="absolute inset-x-0 -bottom-px h-px shimmer-gold opacity-80" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-primary backdrop-blur">
              <Crown className="h-3 w-3" /> Bafana Premium Pass
            </div>
            <h1 className="mt-4 font-display text-[40px] font-black leading-[0.95] tracking-tight">
              Closer to the <span className="text-gradient-gold">action.</span>
            </h1>
            <p className="mt-2 text-sm text-foreground/75">
              VIP stadium experience — for the most committed supporters of Bafana Bafana.
            </p>

            <div className="mt-6 flex items-end gap-2">
              <div className="font-display text-6xl font-black text-gradient-gold leading-none">R99</div>
              <div className="pb-2 text-xs font-semibold text-muted-foreground">/ month</div>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Cancel anytime · Secure payment
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          What you unlock
        </h2>
        <ul className="glass space-y-1 rounded-2xl p-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 ring-glow-gold">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Locked content preview */}
      {!isPremium && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Locked vault
          </h2>
          <div className="relative overflow-hidden rounded-2xl glass">
            <div className="relative h-44 bg-gradient-to-br from-[var(--sa-green)]/40 to-black">
              <div className="absolute inset-0 grid place-items-center font-display text-7xl font-black text-white/8">
                VIP
              </div>
              <div className="absolute inset-0 backdrop-blur-[6px] bg-black/40 grid place-items-center">
                <div className="text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/20 ring-glow-gold">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-2 font-display text-sm font-black uppercase tracking-wider text-primary">
                    Premium only
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="sticky bottom-24 mt-6 px-4">
        <button
          onClick={onSubscribe}
          disabled={loading || isPremium}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-[oklch(0.88_0.18_90)] to-primary py-4 text-sm font-black uppercase tracking-[0.18em] text-primary-foreground shadow-[var(--shadow-glow-gold)] transition disabled:opacity-60"
        >
          {isPremium ? (
            <>
              <Crown className="h-4 w-4" /> Premium Pass Activated
            </>
          ) : loading ? (
            "Activating…"
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Unlock Experience
            </>
          )}
        </button>
      </section>
    </PageContainer>
  );
}
