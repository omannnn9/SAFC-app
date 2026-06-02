import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Trophy } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getNextMatch, getNews, getFeaturedPlayer } from "@/lib/data";
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

function HomePage() {
  const { profile } = useAuth();
  const { data: next } = useQuery({ queryKey: ["next-match"], queryFn: getNextMatch });
  const { data: news } = useQuery({ queryKey: ["news", "home"], queryFn: () => getNews() });
  const { data: featured } = useQuery({ queryKey: ["featured-player"], queryFn: getFeaturedPlayer });
  const c = useCountdown(next?.kickoff);

  return (
    <PageContainer>
      <AppHeader title="Home" />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <img src={heroPlayer} alt="" className="h-[420px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-[pulse-dot_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            The Pulse of the Nation
          </div>
          <h1 className="font-display text-[40px] font-bold leading-[0.92] tracking-tight">
            Stand with <br />
            <span className="text-primary">Bafana Bafana.</span>
          </h1>
          {!profile && (
            <Link
              to="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Join the supporters club <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      {/* Next match */}
      {next && (
        <section className="px-4 pt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Next match
            </h2>
            <Link to="/fixtures" className="text-[11px] text-muted-foreground hover:text-foreground">
              All fixtures →
            </Link>
          </div>
          <Link
            to="/fixtures/$id"
            params={{ id: next.id }}
            className="block overflow-hidden rounded-2xl border border-border bg-surface/60 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary">{next.competition}</div>
                <div className="mt-1 font-display text-xl font-bold leading-tight">
                  {next.is_home ? "South Africa vs " : "vs "}
                  {next.opponent}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {next.venue}
                </div>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--sa-green)] text-2xl">
                🇿🇦
              </div>
            </div>

            {c && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {([
                  ["Days", c.days],
                  ["Hrs", c.hrs],
                  ["Min", c.mins],
                  ["Sec", c.secs],
                ] as const).map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-background/50 p-2.5 text-center">
                    <div className="font-mono text-xl font-bold tabular-nums">
                      {String(v).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Link>
        </section>
      )}

      {/* Quick stats */}
      <section className="grid grid-cols-3 gap-2 px-4 pt-4">
        <Stat label="FIFA Rank" value="58" />
        <Stat label="Form" value="W·W·D" />
        <Stat label="Goals (5)" value="11" />
      </section>

      {/* Featured player */}
      {featured && (
        <section className="px-4 pt-6">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Player spotlight
          </h2>
          <Link
            to="/squad/$id"
            params={{ id: featured.id }}
            className="block overflow-hidden rounded-2xl border border-border bg-surface/60"
          >
            <div className="relative h-56 w-full overflow-hidden">
              <img src={playerTau} alt={featured.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface/95 via-surface/30 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary">
                  #{featured.jersey_number} · {featured.position}
                </div>
                <div className="font-display text-2xl font-bold">{featured.name}</div>
                <div className="text-xs text-muted-foreground">{featured.club}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
              <Stat compact label="Goals" value={featured.goals} />
              <Stat compact label="Caps" value={featured.caps} />
              <Stat compact label="Assists" value={featured.assists} />
            </div>
          </Link>
        </section>
      )}

      {/* News strip */}
      <section className="px-4 pt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Latest news
          </h2>
          <Link to="/news" className="text-[11px] text-muted-foreground hover:text-foreground">
            See all →
          </Link>
        </div>
        <ul className="space-y-3">
          {(news ?? []).slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                to="/news/$slug"
                params={{ slug: a.slug }}
                className="flex gap-3 rounded-xl border border-border bg-surface/60 p-3"
              >
                <div className="grid h-16 w-16 place-items-center rounded-lg bg-[var(--sa-green)]/30">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-primary">
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

function Stat({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div
      className={`text-center ${compact ? "py-3" : "rounded-xl border border-border bg-surface/60 p-3"}`}
    >
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
