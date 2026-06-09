import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Crown, Users, Globe2, Flame, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { SafcLogo } from "@/components/SafcLogo";
import { getFoundersList, getFoundersCount } from "@/lib/membership.functions";
import { FOUNDER_CAP, formatMemberNo } from "@/lib/tiers";

export const Route = createFileRoute("/movement")({
  head: () => ({
    meta: [
      { title: "We Are SAFC — The Movement" },
      { name: "description", content: "SAFC is a movement, not a club. Built by South African supporters, for the diaspora and the home crowd." },
      { property: "og:title", content: "We Are SAFC — The Movement" },
      { property: "og:description", content: "A community of supporters. Chapters, founders, culture — SAFC." },
    ],
  }),
  component: MovementPage,
});

function MovementPage() {
  const listFn = useServerFn(getFoundersList);
  const countFn = useServerFn(getFoundersCount);
  const foundersQ = useQuery({ queryKey: ["founders-list"], queryFn: () => listFn() });
  const countQ = useQuery({ queryKey: ["founders-count"], queryFn: () => countFn() });

  type Founder = { id: string; full_name: string | null; username: string | null; avatar_url: string | null; member_no: number | null };
  const founders = (foundersQ.data as Founder[] | undefined) ?? [];
  const count = (countQ.data as { count: number } | undefined)?.count ?? 0;

  return (
    <PageContainer>
      <AppHeader title="SAFC Movement" />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="safc-backdrop" />
        <div className="relative px-4 py-14 sm:py-24 text-center">
          <SafcLogo className="mx-auto h-16 w-16" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]">
            <Sparkles className="h-3 w-3" /> The movement
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-black tracking-tight sm:text-7xl">
            WE ARE <span className="text-[var(--safc-yellow)]">SAFC</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            Not a club. Not a brand. A movement of South African football supporters — at home and across the diaspora.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/membership" className="inline-flex items-center gap-2 rounded-xl bg-[var(--safc-yellow)] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
              Join the movement <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider">
              Enter the community
            </Link>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="px-4 pt-10">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Our vision</div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Flame, title: "Culture first", body: "Built around matchday energy, fan poetry, and the noise of a packed stand." },
            { icon: Users, title: "Community-owned", body: "Every supporter is a member. No bosses, no corporate gatekeepers." },
            { icon: Globe2, title: "Diaspora connected", body: "A bridge between Joburg, London, Sydney, Dubai — wherever Bafana plays." },
          ].map((p) => (
            <div key={p.title} className="glass rounded-2xl p-5">
              <p.icon className="h-6 w-6 text-[var(--safc-yellow)]" />
              <h3 className="mt-3 font-display text-lg font-black">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TIERS */}
      <section className="px-4 pt-10">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Membership tiers</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "General Member", price: "Free", color: "bg-white/10" },
            { name: "SAFC Basic", price: "Paid", color: "bg-[var(--safc-green)]/30" },
            { name: "SAFC Premium", price: "Paid", color: "bg-[var(--safc-pink)]/30" },
            { name: "Founding Member", price: "Starting XI · 111", color: "bg-[var(--safc-yellow)]/30" },
          ].map((t) => (
            <div key={t.name} className={`rounded-2xl ${t.color} p-4 ring-1 ring-white/10`}>
              <div className="font-display text-base font-black">{t.name}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/70">{t.price}</div>
            </div>
          ))}
        </div>
        <Link to="/membership" className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--safc-yellow)]">
          See full membership <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* FOUNDERS */}
      <section className="px-4 pb-32 pt-10">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Starting XI · Founders</div>
            <h2 className="mt-2 font-display text-2xl font-black tracking-tight">
              <Crown className="mr-2 inline h-6 w-6 text-[var(--safc-yellow)]" />
              {count} / {FOUNDER_CAP} founding members
            </h2>
          </div>
        </div>
        {founders.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
            The Starting XI list opens soon. Become a SAFC member to lock in your spot.
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {founders.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-[var(--safc-yellow)]/30">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-white/10">
                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{f.full_name || f.username || "Supporter"}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--safc-yellow)]">{formatMemberNo(f.member_no)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
