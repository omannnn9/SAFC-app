import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Trophy, Activity, CalendarDays, History, Lightbulb } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getNextMatch, getNews, getFeaturedPlayer } from "@/lib/data";

import { getLivePastMatches } from "@/lib/live.functions";
import { useAuth } from "@/lib/auth";
import heroPlayer from "@/assets/hero-player.jpg";
import playerTau from "@/assets/player-tau.jpg";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bafana Supporters Club — The Pulse of the Nation" },
      {
        name: "description",
        content:
          "Official supporters club for the South African national football team. News, squad, fixtures and premium membership.",
      },
      { property: "og:title", content: "Bafana Supporters Club" },
      {
        property: "og:description",
        content: "The official digital home for Bafana Bafana supporters.",
      },
    ],
  }),
  component: HomePage,
});

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hrs: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}
const FUN_FACTS = [
  "South Africa won AFCON in 1996 on home soil — their first major title.",
  "Bafana Bafana made their FIFA World Cup debut in France '98.",
  "Benni McCarthy is Bafana's all-time top scorer with 31 international goals.",
  "South Africa hosted the 2010 FIFA World Cup — the first on African soil.",
  "Lucas Radebe was knighted by Nelson Mandela as 'my hero'.",
  "Bafana's nickname means 'The Boys' in isiZulu.",
];

function HomePage() {
  const { profile } = useAuth();
  const { data: next } = useQuery({ queryKey: ["next-match"], queryFn: getNextMatch });
  const { data: news } = useQuery({ queryKey: ["news", "home"], queryFn: () => getNews() });
  const { data: featured } = useQuery({ queryKey: ["featured-player"], queryFn: getFeaturedPlayer });
  const { data: pastRes } = useQuery({ queryKey: ["past-matches"], queryFn: () => getLivePastMatches() });
  const past = pastRes?.data ?? [];
  const c = useCountdown(next?.kickoff);
  const nextHome = next?.home_team ?? null;
  const nextAway = next?.away_team ?? null;

  const form = useMemo(() => {
    return past.slice(0, 5).map((m) => {
      const isHome = m.home_team?.name?.toLowerCase().includes("south africa");
      const our = (isHome ? m.home_score : m.away_score) ?? 0;
      const their = (isHome ? m.away_score : m.home_score) ?? 0;
      if (our > their) return "W" as const;
      if (our === their) return "D" as const;
      return "L" as const;
    });
  }, [past]);
  const lastMatch = past[0];

  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <PageContainer>
      {/* SignupBadge removed per request — keep auth clean */}
      <AppHeader title="Home" />

      {/* HERO — Stadium broadcast */}
      <section className="relative noise overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroPlayer} alt="" className="slow-zoom h-[540px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/55 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,color-mix(in_oklab,var(--sa-gold)_22%,transparent),transparent_70%)]" />
          <div
            className="absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/8 to-transparent blur-2xl"
            style={{ animation: "spotlight-sweep 7s ease-in-out infinite" }}
          />
        </div>

        <div className="relative z-10 px-5 pt-6 pb-10 min-h-[540px] flex flex-col">
          <div className="inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--sa-green)]" />
            The Pulse of the Nation
          </div>

          <h1 className="mt-4 font-display text-[44px] font-black leading-[0.9] tracking-tight">
            Stand with
            <br />
            <span className="text-gradient-gold">Bafana Bafana.</span>
          </h1>
          <p className="mt-2 max-w-[280px] text-sm text-foreground/70">
            Stadium-level access. Exclusive content. One nation. One team.
          </p>

          <div className="mt-auto pt-8">
            {next && (
              <Link
                to="/fixtures/$id"
                params={{ id: next.id }}
                className="glass-strong block overflow-hidden rounded-2xl p-4 ring-glow-gold"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                  <span className="text-primary font-bold">{next.competition}</span>
                  <span className="text-muted-foreground">Next match</span>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TeamBadge name={nextHome?.name ?? "TBD"} logo={nextHome?.logo} accent={nextHome?.is_bafana} />
                  <div className="text-center">
                    {c && (
                      <div className="font-mono text-2xl font-black tabular-nums leading-none text-primary">
                        {String(c.days).padStart(2, "0")}:{String(c.hrs).padStart(2, "0")}:{String(c.mins).padStart(2, "0")}
                      </div>
                    )}
                    <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      Days · Hrs · Min
                    </div>
                  </div>
                  <TeamBadge name={nextAway?.name ?? "TBD"} logo={nextAway?.logo} accent={nextAway?.is_bafana} />
                </div>

                <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {next.venue}
                </div>
              </Link>
            )}

            {!profile && (
              <Link
                to="/signup"
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-[oklch(0.7_0.16_70)] py-3.5 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow-gold)]"
              >
                Join the supporters club <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* TEAM INSIGHTS — clean 4-card panel */}
      <section className="mt-8 px-4">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Team insights
          </h2>
          <span className="text-[10px] text-muted-foreground/70">Bafana Bafana</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InsightCard icon={<Sparkles className="h-3.5 w-3.5" />} label="Form">
            {form.length === 0 ? (
              <div className="text-xs text-muted-foreground">No recent matches</div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  {form.map((r, i) => (
                    <span
                      key={i}
                      className={`grid h-7 w-7 place-items-center rounded-md text-[11px] font-black ${
                        r === "W"
                          ? "bg-[color:var(--sa-green)] text-white"
                          : r === "D"
                            ? "bg-muted text-foreground"
                            : "bg-destructive/80 text-white"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Last {form.length} matches
                </div>
              </>
            )}
          </InsightCard>

          <InsightCard icon={<History className="h-3.5 w-3.5" />} label="Last match">
            {lastMatch ? (
              <>
                <div className="truncate font-display text-lg font-black leading-tight">
                  {lastMatch.opponent}
                </div>
                <div className="mt-0.5 font-mono text-xl font-black tabular-nums text-primary">
                  {lastMatch.home_score ?? "—"}–{lastMatch.away_score ?? "—"}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(lastMatch.kickoff).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
          </InsightCard>

          <InsightCard icon={<CalendarDays className="h-3.5 w-3.5" />} label="Next match">
            {next ? (
              <>
                <div className="truncate font-display text-lg font-black leading-tight">
                  {nextHome?.is_bafana ? nextAway?.name : nextHome?.name}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {next.competition}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(next.kickoff).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} ·{" "}
                  {new Date(next.kickoff).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">TBD</div>
            )}
          </InsightCard>

          <InsightCard icon={<Trophy className="h-3.5 w-3.5" />} label="Did you know?">
            <div key={factIdx} className="animate-[fade-in_0.5s_ease-out] text-[11px] leading-snug text-foreground/85">
              {FUN_FACTS[factIdx]}
            </div>
          </InsightCard>
        </div>
      </section>



      {/* Player spotlight */}
      {featured && (
        <section className="mt-2 px-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Player spotlight
          </h2>
          <Link
            to="/squad/$id"
            params={{ id: featured.id }}
            className="group glass relative block overflow-hidden rounded-2xl ring-glow-gold transition"
          >
            <div className="relative h-64 w-full overflow-hidden">
              <img
                src={featured.photo_url ?? playerTau}
                alt={featured.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                  {featured.flag_url && <img src={featured.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}
                  <span>{featured.position_label || featured.position}</span>
                </div>
                <div className="font-display text-3xl font-black leading-tight">{featured.name}</div>
              </div>
            </div>
          </Link>

        </section>
      )}

      {/* Engagement zone — Premium CTA */}
      {!profile?.is_premium && (
        <section className="mt-6 px-4">
          <Link
            to="/premium"
            className="relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-[oklch(0.18_0.05_85)] via-black to-black p-5 shadow-[var(--shadow-glow-gold)]"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl breathe" />
            <div className="relative">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">VIP Pass</div>
              <div className="mt-1 font-display text-2xl font-black leading-tight">
                Unlock the <span className="text-gradient-gold">premium experience</span>
              </div>
              <div className="mt-1 text-xs text-foreground/70">Exclusive content · Early tickets · Premium card</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground">
                Get Premium Pass <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* News strip */}
      <section className="mt-6 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Latest news
          </h2>
          <Link to="/news" className="text-[11px] font-medium text-primary">
            See all →
          </Link>
        </div>
        <ul className="space-y-3">
          {(news ?? []).slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                to="/news/$slug"
                params={{ slug: a.slug }}
                className="glass flex gap-3 rounded-xl p-3 transition hover:ring-glow-gold"
              >
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--sa-green)]/50 to-black">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                    {a.category}
                  </div>
                  <div className="line-clamp-2 text-sm font-semibold leading-tight">{a.title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(a.published_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}


function TeamBadge({ name, logo, accent }: { name: string; logo?: string | null; accent?: boolean }) {
  const short = name.length <= 3 ? name.toUpperCase() : name.slice(0, 3).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`grid h-14 w-14 place-items-center overflow-hidden rounded-xl ${
          accent ? "bg-[var(--sa-green)] ring-glow-green" : "bg-surface-2"
        }`}
      >
        {logo ? (
          <img src={logo} alt={name} className="h-10 w-10 object-contain" />
        ) : (
          <span className="font-display text-sm font-black">{short}</span>
        )}
      </div>
      <div className="font-display text-[11px] font-black tracking-wider">{short}</div>
    </div>
  );
}


function InsightCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass relative rounded-2xl border border-border/60 bg-surface/40 p-4 shadow-[var(--shadow-card-lift)] min-h-[120px] flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--sa-gold)]/15 text-[color:var(--sa-gold)]">
          {icon}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

