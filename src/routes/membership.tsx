import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Crown, Sparkles, ArrowRight, LogIn, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { DigitalCard } from "@/components/DigitalCard";
import { TIERS, tierTone, FOUNDER_CAP, type Tier } from "@/lib/tiers";
import { useAuth } from "@/lib/auth";
import { listTierConfig, getMyMembership, getFoundersCount } from "@/lib/membership.functions";
import { createCheckoutSession, createBillingPortalSession, getMySubscription } from "@/lib/billing.functions";


export const Route = createFileRoute("/membership")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Membership — SAFC" },
      { name: "description", content: "Join the SAFC movement. Free, Basic, Premium and Founding Member tiers — your digital supporter card included." },
      { property: "og:title", content: "SAFC Membership — We Are SAFC" },
      { property: "og:description", content: "Become part of the South African Football Community. Choose your tier and get your digital member card." },
    ],
  }),
  component: MembershipPage,
});

type Interval = "monthly" | "annual";

function rands(cents: number, interval: Interval) {
  if (!cents) return "FREE";
  return `R${(cents / 100).toFixed(0)}/${interval === "annual" ? "yr" : "mo"}`;
}

/** Annual = 10x monthly (2 months free). */
function annualCents(monthlyCents: number) {
  return monthlyCents * 10;
}

function MembershipPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { checkout } = Route.useSearch();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busyTier, setBusyTier] = useState<Tier | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const listFn = useServerFn(listTierConfig);
  const meFn = useServerFn(getMyMembership);
  const countFn = useServerFn(getFoundersCount);
  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createBillingPortalSession);
  const subFn = useServerFn(getMySubscription);

  const tiersQ = useQuery({ queryKey: ["tier-config"], queryFn: () => listFn() });
  const meQ = useQuery({ queryKey: ["my-membership", user?.id], queryFn: () => meFn(), enabled: !!user });
  const foundersQ = useQuery({ queryKey: ["founders-count"], queryFn: () => countFn() });
  const subQ = useQuery({ queryKey: ["my-subscription", user?.id], queryFn: () => subFn(), enabled: !!user });

  useEffect(() => {
    if (!checkout) return;
    if (checkout === "success") {
      toast.success("Payment received — welcome to your new tier! It may take a few seconds to activate.");
      qc.invalidateQueries({ queryKey: ["my-membership"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["founders-count"] });
      refreshProfile?.();
    } else if (checkout === "cancel") {
      toast.info("Checkout cancelled — no payment was taken.");
    }
    navigate({ to: "/membership", search: { checkout: undefined }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  type TierRow = { id: Tier; name: string; tagline: string | null; price_cents: number; perks: string[]; visible: boolean; sort_order: number };
  const tiers: TierRow[] =
    (tiersQ.data as TierRow[] | undefined)?.filter((t) => t.visible) ??
    TIERS.map((t, i) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      price_cents: t.priceCents,
      perks: t.perks,
      visible: true,
      sort_order: i,
    }));

  const me = meQ.data as
    | { full_name: string | null; avatar_url: string | null; tier: Tier; member_no: number | null; is_founder: boolean; created_at: string }
    | null
    | undefined;
  const sub = subQ.data as
    | { id: string; tier: Tier | null; status: string; interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean }
    | null
    | undefined;
  const hasActiveSub = sub?.status === "active";
  const foundersLeft = foundersQ.data ? FOUNDER_CAP - (foundersQ.data as { count: number }).count : null;

  const startCheckout = async (tier: Tier) => {
    if (tier === "free") return;
    setBusyTier(tier);
    try {
      const res = await checkoutFn({ data: { tier: tier as "basic" | "premium" | "founder", interval } });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusyTier(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await portalFn();
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
      setPortalBusy(false);
    }
  };

  return (
    <PageContainer>
      <AppHeader title="Membership" />

      {/* Hero */}
      <section className="relative px-4 pt-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--safc-green)]/60 via-black to-[var(--safc-cobalt)]/40 p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
            <Sparkles className="h-3 w-3" /> We are SAFC
          </div>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-5xl">
            Become part of the movement.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            Free to join. Upgrade when you're ready to ride harder. Every member gets a digital SAFC card with their own unique member number.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!user && (
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground">
                <LogIn className="h-4 w-4" /> Join free
              </Link>
            )}
            <Link to="/movement" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-white/20">
              The SAFC movement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {foundersLeft !== null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--safc-yellow)]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--safc-yellow)] ring-1 ring-[var(--safc-yellow)]/40">
              <Crown className="h-3 w-3" /> {foundersLeft} of {FOUNDER_CAP} Founding spots remaining
            </div>
          )}
        </div>
      </section>

      {/* Personal card */}
      {user && me && (
        <section className="px-4 pt-8">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Your SAFC card</div>
          <DigitalCard
            tier={me.tier}
            fullName={me.full_name ?? profile?.full_name ?? user.email ?? "Supporter"}
            avatarUrl={me.avatar_url ?? profile?.avatar_url ?? null}
            memberNo={me.member_no}
            isFounder={me.is_founder}
            joinedAt={me.created_at}
          />
          {hasActiveSub && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex-1 text-xs text-white/70">
                <span className="font-black uppercase tracking-wider text-white">Active membership</span>
                {sub?.interval && <> · billed {sub.interval === "annual" ? "yearly" : "monthly"}</>}
                {sub?.current_period_end && (
                  <> · {sub.cancel_at_period_end ? "ends" : "renews"} {new Date(sub.current_period_end).toLocaleDateString()}</>
                )}
              </div>
              <button
                onClick={openPortal}
                disabled={portalBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider hover:bg-white/20 disabled:opacity-60"
              >
                {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Manage billing
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tier grid */}
      <section className="px-4 pb-32 pt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Choose your tier</div>
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-[10px] font-black uppercase tracking-wider">
            <button
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-3 py-1.5 transition ${interval === "monthly" ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`rounded-full px-3 py-1.5 transition ${interval === "annual" ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white"}`}
            >
              Annual <span className={interval === "annual" ? "opacity-80" : "text-[var(--safc-yellow)]"}>· 2 months free</span>
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => {
            const def = TIERS.find((x) => x.id === t.id)!;
            const tone = tierTone(t.id);
            const Icon = def.icon;
            const isMine = me?.tier === t.id;
            const isFounder = t.id === "founder";
            const founderFull = isFounder && foundersLeft !== null && foundersLeft <= 0;
            const displayCents = t.price_cents === 0 ? 0 : interval === "annual" ? annualCents(t.price_cents) : t.price_cents;
            return (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-3xl p-[2px] ${isFounder ? "safc-card-glow" : ""}`}
                style={{ background: tone.grad, backgroundSize: "200% 200%" }}
              >
                <div className="flex h-full flex-col rounded-[22px] bg-[#0b0b0b] p-5">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-6 w-6 ${tone.text}`} />
                    {isMine && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">Your tier</span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-black tracking-tight">{t.name}</h3>
                  <p className="mt-1 text-xs text-white/60">{t.tagline}</p>
                  <div className={`mt-3 font-display text-2xl font-black ${tone.text}`}>
                    {rands(displayCents, interval)}
                    {t.price_cents > 0 && interval === "annual" && (
                      <span className="ml-2 align-middle text-[10px] font-black uppercase tracking-wider text-[var(--safc-yellow)]">2 months free</span>
                    )}
                  </div>
                  <ul className="mt-4 flex-1 space-y-1.5 text-xs text-white/80">
                    {t.perks.map((p) => (
                      <li key={p} className="flex gap-2"><Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.text}`} /> {p}</li>
                    ))}
                  </ul>
                  {!user ? (
                    <Link to="/signup" className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider hover:bg-white/20">
                      Start with {def.badge}
                    </Link>
                  ) : isMine ? (
                    <div className="mt-5 rounded-xl bg-white/5 px-4 py-2 text-center text-[11px] font-black uppercase tracking-wider text-white/60">Active</div>
                  ) : t.price_cents === 0 ? (
                    hasActiveSub ? (
                      <button
                        onClick={openPortal}
                        disabled={portalBusy}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider hover:bg-white/20 disabled:opacity-60"
                      >
                        Cancel paid plan
                      </button>
                    ) : (
                      <div className="mt-5 rounded-xl bg-white/5 px-4 py-2 text-center text-[11px] font-black uppercase tracking-wider text-white/40">Included free</div>
                    )
                  ) : founderFull ? (
                    <div className="mt-5 rounded-xl bg-white/5 px-4 py-2 text-center text-[11px] font-black uppercase tracking-wider text-white/40">Starting XI full</div>
                  ) : hasActiveSub ? (
                    <button
                      onClick={openPortal}
                      disabled={portalBusy}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider hover:bg-white/20 disabled:opacity-60"
                    >
                      Switch via billing portal
                    </button>
                  ) : (
                    <button
                      onClick={() => startCheckout(t.id)}
                      disabled={busyTier !== null}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
                    >
                      {busyTier === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Upgrade to {def.badge}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[11px] text-white/40">
          Payments are processed securely by Stripe. Prices in South African Rand (ZAR). Cancel anytime via Manage billing.
        </p>
      </section>
    </PageContainer>
  );
}
