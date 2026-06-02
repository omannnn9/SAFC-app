import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Calendar, MapPin, Trophy } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getMatch } from "@/lib/data";
import { SOUTH_AFRICA_TEAM_ID, validateCountryFlag, validateFixtureFlagData } from "@/lib/flags";

export const Route = createFileRoute("/fixtures/$id")({
  head: () => ({ meta: [{ title: "Match — Bafana" }] }),
  component: MatchPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load match: {error.message}</div>
  ),
});

function MatchPage() {
  const { id } = Route.useParams();
  const { data: m, isLoading } = useQuery({ queryKey: ["match", id], queryFn: () => getMatch(id) });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!m) throw notFound();
  const k = new Date(m.kickoff);
  const home = m.home_team ?? {
    id: m.is_home ? SOUTH_AFRICA_TEAM_ID : null,
    name: m.is_home ? "South Africa" : m.opponent,
    logo: m.is_home ? `https://media.api-sports.io/football/teams/${SOUTH_AFRICA_TEAM_ID}.png` : m.opponent_flag,
    country_code: m.is_home ? "ZA" : null,
  };
  const away = m.away_team ?? {
    id: m.is_home ? null : SOUTH_AFRICA_TEAM_ID,
    name: m.is_home ? m.opponent : "South Africa",
    logo: m.is_home ? m.opponent_flag : `https://media.api-sports.io/football/teams/${SOUTH_AFRICA_TEAM_ID}.png`,
    country_code: m.is_home ? null : "ZA",
  };
  validateFixtureFlagData(m.id, home, away, "fixture-detail-ui");

  return (
    <PageContainer>
      <AppHeader title="Match" />
      <div className="px-4 pt-3">
        <Link to="/fixtures" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> All fixtures
        </Link>
      </div>

      <section className="px-4 pt-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary">{m.competition}</div>
        <div className="mt-2 flex items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-[var(--sa-green)]/40 via-black to-black p-5">
          <Side
            logo={home.logo}
            name={home.name}
            countryCode={home.country_code}
          />
          {m.status === "completed" ? (
            <div className="font-display text-4xl font-black tabular-nums">
              {m.home_score}–{m.away_score}
            </div>
          ) : (
            <div className="font-display text-lg font-bold text-muted-foreground">VS</div>
          )}
          <Side
            logo={away.logo}
            name={away.name}
            countryCode={away.country_code}
          />
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface/60 p-4 text-sm">
          <Row icon={<Calendar className="h-4 w-4" />} label="Kick-off">
            {k.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long" })} ·{" "}
            {k.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Venue">
            {m.venue}
          </Row>
          <Row icon={<Trophy className="h-4 w-4" />} label="Competition">
            {m.competition}
          </Row>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Highlights
          </div>
          <div className="mt-3 grid aspect-video place-items-center rounded-lg bg-black/60 text-xs text-muted-foreground">
            {m.status === "completed" ? "Highlights coming soon" : "Available after kick-off"}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface/60 p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Lineups
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Confirmed lineups published 1 hour before kick-off.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}

function Side({ name, countryCode }: { logo?: string | null; name: string; countryCode?: string | null }) {
  const { flag } = validateCountryFlag(name, countryCode);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-16 w-16 place-items-center rounded-xl bg-black/40">
        <span className="text-3xl leading-none">{flag}</span>
      </div>
      <div className="max-w-[90px] text-center text-xs font-semibold">{name}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}
