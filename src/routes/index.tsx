import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  MapPin,
  Trophy,
  Activity,
  CalendarDays,
  History,
  Lightbulb,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getNextMatch, getNews, getFeaturedPlayer } from "@/lib/data";

import { getLivePastMatches } from "@/lib/live.functions";
import { useAuth } from "@/lib/auth";
import heroPlayer from "@/assets/hero-player.jpg";
import heroBafana2 from "@/assets/hero-bafana-2.jpg";
import heroBafana3 from "@/assets/hero-bafana-3.jpg";
import heroBafana4 from "@/assets/hero-bafana-4.jpg";
import playerTau from "@/assets/player-tau.jpg";

const HERO_IMAGES = [heroPlayer, heroBafana2, heroBafana3, heroBafana4];

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
  const ms = new Date(target).getTime() - now;
  const isLive = ms <= 0 && ms > -3 * 3600 * 1000; // within match window
  const diff = Math.max(0, ms);
  return {
    isLive,
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
  const { data: next } = useQuery({
    queryKey: ["next-match"],
    queryFn: getNextMatch,
    refetchInterval: 1000 * 60, // refresh every minute
    refetchOnWindowFocus: true,
  });
  const { data: news } = useQuery({
    queryKey: ["news", "home"],
    queryFn: () => getNews(),
    refetchInterval: 1000 * 60 * 10,
  });
  const { data: featured } = useQuery({
    queryKey: ["featured-player"],
    queryFn: getFeaturedPlayer,
  });
  const { data: pastRes } = useQuery({
    queryKey: ["past-matches"],
    queryFn: () => getLivePastMatches(),
    refetchInterval: 1000 * 45, // refresh every 45s for live score updates
    refetchOnWindowFocus: true,
  });
  const past = useMemo(() => pastRes?.data ?? [], [pastRes?.data]);

  const c = useCountdown(next?.kickoff);

  // Hero image rotator — premium crossfade every 6s, pauses when tab hidden
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    // Preload all hero images for seamless crossfade
    HERO_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    const tick = () => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length);
    let id = window.setInterval(tick, 6000);
    const onVis = () => {
      window.clearInterval(id);
      if (!document.hidden) id = window.setInterval(tick, 6000);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
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
          <div className="relative h-[540px] w-full overflow-hidden">
            {HERO_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                aria-hidden="true"
                className={`slow-zoom absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[1600ms] ease-in-out ${
                  i === heroIdx ? "opacity-100" : "opacity-0"
                }`}
                style={{ willChange: "opacity" }}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            ))}
          </div>
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
                  <TeamBadge
                    name={nextHome?.name ?? "TBD"}
                    logo={nextHome?.logo}
                    accent={nextHome?.is_bafana}
                  />
                  <div className="text-center">
                    {c?.isLive ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sa-green)] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white live-dot">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live Now
                      </div>
                    ) : c ? (
                      <>
                        <div className="font-mono text-2xl font-black tabular-nums leading-none text-primary">
                          {String(c.days).padStart(2, "0")}:{String(c.hrs).padStart(2, "0")}:
                          {String(c.mins).padStart(2, "0")}
                        </div>
                        <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                          Days · Hrs · Min
                        </div>
                      </>
                    ) : null}
                  </div>
                  <TeamBadge
                    name={nextAway?.name ?? "TBD"}
                    logo={nextAway?.logo}
                    accent={nextAway?.is_bafana}
                  />
                </div>


                <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {next.venue}
                </div>
              </Link>
            )}

            {!profile && (
              <Link
                to="/signup"
                className="mt-4 flex items-center justify-center rounded-full bg-primary py-3.5 text-sm font-black uppercase tracking-wider text-primary-foreground"
              >
                Join the supporters club
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* TEAM INSIGHTS — premium standout cards */}
      <section className="mt-10 px-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              Bafana Bafana
            </div>
            <h2 className="mt-1 font-display text-xl font-black tracking-tight">Team Insights</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* FORM — green */}
          <PremiumCard icon={<Activity className="h-4 w-4" />} label="Team Form" tint="green">
            {form.length === 0 ? (
              <div className="text-sm text-white/70">Form data unavailable</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {form.map((r, i) => (
                    <span
                      key={i}
                      className={`grid h-10 w-10 place-items-center rounded-lg text-base font-black shadow-md ${
                        r === "W"
                          ? "bg-white text-[color:var(--sa-green)]"
                          : r === "D"
                            ? "bg-white/25 text-white"
                            : "bg-black/40 text-white"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/70">
                  Last {form.length} matches
                </div>
              </>
            )}
          </PremiumCard>

          {/* LAST MATCH — blue */}
          <PremiumCard icon={<History className="h-4 w-4" />} label="Last Match" tint="blue">
            {lastMatch ? (
              (() => {
                const our =
                  (lastMatch.is_home ? lastMatch.home_score : lastMatch.away_score) ?? null;
                const their =
                  (lastMatch.is_home ? lastMatch.away_score : lastMatch.home_score) ?? null;
                const result =
                  our === null || their === null
                    ? null
                    : our > their
                      ? "W"
                      : our === their
                        ? "D"
                        : "L";
                const resultLabel =
                  result === "W" ? "Win" : result === "D" ? "Draw" : result === "L" ? "Loss" : "";
                const resultClass =
                  result === "W"
                    ? "bg-white text-[color:var(--sa-green)]"
                    : result === "D"
                      ? "bg-white/25 text-white"
                      : "bg-black/50 text-white";
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
                          {lastMatch.is_home ? "Home" : "Away"}
                        </div>
                        <div className="break-words font-display text-2xl font-black leading-tight text-white">
                          South Africa {lastMatch.is_home ? "vs" : "@"} {lastMatch.opponent}
                        </div>
                      </div>
                      {result && (
                        <span
                          className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-3 text-sm font-black shadow ${resultClass}`}
                        >
                          {result}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <span className="font-mono text-5xl font-black leading-none tabular-nums text-white">
                        {our ?? "—"}–{their ?? "—"}
                      </span>
                      {resultLabel && (
                        <span className="pb-1 text-xs font-bold uppercase tracking-[0.16em] text-white/80">
                          {resultLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70 sm:flex-row sm:items-center sm:justify-between">
                      <span className="break-words">{lastMatch.competition}</span>
                      <span className="shrink-0">
                        {new Date(lastMatch.kickoff).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}

                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="text-sm text-white/70">Last match data not available</div>
            )}
          </PremiumCard>

          {/* NEXT MATCH — gold */}
          <PremiumCard icon={<CalendarDays className="h-4 w-4" />} label="Next Match" tint="gold">
            {next ? (
              <>
                <div className="break-words font-display text-2xl font-black leading-tight text-black">
                  vs {nextHome?.is_bafana ? nextAway?.name : nextHome?.name}
                </div>
                <div className="mt-2 break-words text-[11px] font-bold uppercase tracking-[0.12em] text-black/70">
                  {next.competition}
                </div>
                {(() => {
                  const k = new Date(next.kickoff);
                  const sameAsSAST = -k.getTimezoneOffset() === 120;
                  return (
                    <>
                      <div className="mt-2 text-[11px] font-semibold tabular-nums text-black/80">
                        {k.toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" })}{" "}
                        ·{" "}
                        {k.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" })}{" "}
                        SAST
                      </div>
                      {!sameAsSAST && (
                        <div className="mt-1 text-[10px] tabular-nums text-black/60">
                          {k.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })} your time
                        </div>
                      )}
                    </>
                  );
                })()}

              </>
            ) : (
              <div className="text-sm text-black/70">Next fixture to be confirmed</div>
            )}
          </PremiumCard>

          {/* FUN FACT — red */}
          <PremiumCard icon={<Lightbulb className="h-4 w-4" />} label="Did You Know?" tint="red">
            <div
              key={factIdx}
              className="animate-[fade-in_0.5s_ease-out] text-sm leading-snug text-white"
            >
              {FUN_FACTS[factIdx]}
            </div>
          </PremiumCard>
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
                  {featured.flag_url && (
                    <img
                      src={featured.flag_url}
                      alt=""
                      className="h-3 w-4 rounded-sm object-cover"
                    />
                  )}
                  <span>{featured.position_label || featured.position}</span>
                </div>
                <div className="font-display text-3xl font-black leading-tight">
                  {featured.name}
                </div>
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
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                VIP Pass
              </div>
              <div className="mt-1 font-display text-2xl font-black leading-tight">
                Unlock the <span className="text-gradient-gold">premium experience</span>
              </div>
              <div className="mt-1 text-xs text-foreground/70">
                Exclusive content · Early tickets · Premium card
              </div>
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
                    {new Date(a.published_at).toLocaleDateString(undefined, {
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

function TeamBadge({
  name,
  logo,
  accent,
}: {
  name: string;
  logo?: string | null;
  accent?: boolean;
}) {
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

type Tint = "green" | "blue" | "gold" | "red";

const TINT_STYLES: Record<Tint, { bg: string; ring: string; label: string; chip: string }> = {
  green: {
    bg: "bg-[linear-gradient(135deg,oklch(0.45_0.14_155)_0%,oklch(0.32_0.12_155)_100%)]",
    ring: "shadow-[0_18px_40px_-12px_oklch(0.45_0.14_155_/_0.55)]",
    label: "text-white/80",
    chip: "bg-white/15 text-white",
  },
  blue: {
    bg: "bg-[linear-gradient(135deg,oklch(0.48_0.16_245)_0%,oklch(0.28_0.13_255)_100%)]",
    ring: "shadow-[0_18px_40px_-12px_oklch(0.48_0.16_245_/_0.55)]",
    label: "text-white/80",
    chip: "bg-white/15 text-white",
  },
  gold: {
    bg: "bg-[linear-gradient(135deg,oklch(0.88_0.18_90)_0%,oklch(0.72_0.18_70)_100%)]",
    ring: "shadow-[0_18px_40px_-12px_oklch(0.78_0.18_85_/_0.65)]",
    label: "text-black/70",
    chip: "bg-black/15 text-black",
  },
  red: {
    bg: "bg-[linear-gradient(135deg,oklch(0.55_0.22_25)_0%,oklch(0.38_0.18_15)_100%)]",
    ring: "shadow-[0_18px_40px_-12px_oklch(0.55_0.22_25_/_0.55)]",
    label: "text-white/80",
    chip: "bg-white/15 text-white",
  },
};

function PremiumCard({
  icon,
  label,
  tint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tint: Tint;
  children: React.ReactNode;
}) {
  const t = TINT_STYLES[tint];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 min-h-[178px] flex flex-col ring-1 ring-white/10 ${t.bg} ${t.ring}`}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative mb-4 flex items-center gap-2">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.chip}`}>
          {icon}
        </div>
        <span
          className={`min-w-0 break-words text-[10px] font-bold uppercase tracking-[0.14em] ${t.label}`}
        >
          {label}
        </span>
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}
