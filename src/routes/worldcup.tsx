import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Radio, Settings, Trophy } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import {
  WORLD_CUP_TOTAL_MATCHES,
  WorldCupFlag,
  WorldCupMatch,
  displayTeamName,
  formatCountdown,
  flagMap,
  getKickoff,
  liveMinute,
  stageLabel,
  statusOf,
} from "@/lib/world-cup";

export const Route = createFileRoute("/worldcup")({
  head: () => ({
    meta: [
      { title: "FIFA World Cup 2026 — SAFC" },
      {
        name: "description",
        content: "All 104 FIFA World Cup 2026 fixtures, live countdowns and results.",
      },
    ],
  }),
  component: WorldCupPage,
});

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function WorldCupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = useNow();
  const [tab, setTab] = useState<"upcoming" | "live" | "results">("upcoming");

  // Live-sync admin edits to matches
  useEffect(() => {
    const ch = supabase
      .channel("wc-matches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_cup_matches" }, () => {
        qc.invalidateQueries({ queryKey: ["wc-matches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const isAdminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const matchesQ = useQuery({
    queryKey: ["wc-matches"],
    queryFn: async () => {
      const { data, error } = await db
        .from("world_cup_matches")
        .select("*")
        .order("match_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorldCupMatch[];
    },
    refetchInterval: 30_000,
  });

  const flagsQ = useQuery({
    queryKey: ["wc-flags"],
    queryFn: async () => {
      const { data, error } = await db
        .from("world_cup_country_flags")
        .select("country_name, flag, is_placeholder");
      if (error) throw error;
      return (data ?? []) as WorldCupFlag[];
    },
    refetchInterval: 60_000,
  });

  const flagsByCountry = useMemo(() => flagMap(flagsQ.data ?? []), [flagsQ.data]);

  const { upcoming, live, finished } = useMemo(() => {
    const list = (matchesQ.data ?? []).map((match) => ({
      ...match,
      home_flag: flagsByCountry.get(match.home_team) ?? match.home_flag,
      away_flag: flagsByCountry.get(match.away_team) ?? match.away_flag,
    }));
    const upcomingMatches: WorldCupMatch[] = [];
    const liveMatches: WorldCupMatch[] = [];
    const finishedMatches: WorldCupMatch[] = [];
    for (const match of list) {
      const status = statusOf(match, now);
      if (status === "upcoming") upcomingMatches.push(match);
      else if (status === "live") liveMatches.push(match);
      else finishedMatches.push(match);
    }
    upcomingMatches.sort(
      (a, b) => new Date(getKickoff(a)).getTime() - new Date(getKickoff(b)).getTime(),
    );
    liveMatches.sort((a, b) => a.match_number - b.match_number);
    finishedMatches.sort(
      (a, b) => new Date(getKickoff(b)).getTime() - new Date(getKickoff(a)).getTime(),
    );
    return { upcoming: upcomingMatches, live: liveMatches, finished: finishedMatches };
  }, [flagsByCountry, matchesQ.data, now]);

  const total = matchesQ.data?.length ?? 0;

  return (
    <PageContainer>
      <AppHeader title="World Cup" />

      <section className="px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              FIFA World Cup 2026
            </div>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
              {total || WORLD_CUP_TOTAL_MATCHES} match slots.{" "}
              <span className="text-gradient-gold">Always live</span>.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Database-driven fixtures with automatic countdowns, live windows, verified flags and
              results.
            </p>
          </div>
          {isAdminQ.data && (
            <Link
              to="/admin/worldcup"
              className="glass flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider text-foreground hover:bg-surface-2"
            >
              <Settings className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total" value={`${total}/${WORLD_CUP_TOTAL_MATCHES}`} />
          <Stat label="Upcoming" value={String(upcoming.length)} />
          <Stat label="Live" value={String(live.length)} active={live.length > 0} />
          <Stat label="Results" value={String(finished.length)} />
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-3 rounded-xl p-1">
          {(
            [
              { id: "upcoming", label: `Upcoming · ${upcoming.length}` },
              { id: "live", label: live.length ? `Live · ${live.length}` : "Live" },
              { id: "results", label: `Results · ${finished.length}` },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setTab(filter.id)}
              className={`rounded-lg py-2 text-[10px] font-black uppercase tracking-wider transition ${
                tab === filter.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.id === "live" && live.length > 0 && (
                <Radio className="mr-1 inline h-2.5 w-2.5 animate-pulse text-destructive" />
              )}
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 px-4 pb-32">
        {(matchesQ.isLoading || flagsQ.isLoading) && (
          <div className="glass h-24 animate-pulse rounded-2xl" />
        )}
        {matchesQ.error && <EmptyState text="World Cup fixtures could not load." />}
        {!matchesQ.isLoading && tab === "upcoming" && upcoming.length === 0 && (
          <EmptyState text="No upcoming matches." />
        )}
        {tab === "upcoming" &&
          upcoming.map((match) => <MatchLink key={match.id} match={match}><UpcomingCard match={match} now={now} /></MatchLink>)}
        {!matchesQ.isLoading && tab === "live" && live.length === 0 && (
          <EmptyState text="No matches are live right now. Check back at kickoff." />
        )}
        {tab === "live" && live.map((match) => <MatchLink key={match.id} match={match}><LiveCard match={match} now={now} /></MatchLink>)}
        {!matchesQ.isLoading && tab === "results" && finished.length === 0 && (
          <EmptyState text="No finished matches yet." />
        )}
        {tab === "results" && finished.map((match) => <MatchLink key={match.id} match={match}><ResultCard match={match} /></MatchLink>)}
      </section>
    </PageContainer>
  );
}

function MatchLink({ match, children }: { match: WorldCupMatch; children: React.ReactNode }) {
  if (!match.event_id) return <div className="block">{children}</div>;
  return (
    <Link to="/events/$id" params={{ id: match.event_id }} className="block transition hover:opacity-90 active:scale-[0.99]">
      {children}
    </Link>
  );
}

function Stat({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className={`glass rounded-xl p-2 text-center ${active ? "ring-1 ring-destructive" : ""}`}>
      <div className="font-display text-base font-black tabular-nums sm:text-lg">{value}</div>
      <div className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
      <Trophy className="mx-auto mb-2 h-6 w-6 text-accent" />
      {text}
    </div>
  );
}

function TeamRow({
  flag,
  name,
  align = "left",
}: {
  flag: string;
  name: string;
  align?: "left" | "right";
}) {
  const display = displayTeamName(name);
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <span className="text-2xl leading-none">{flag}</span>
      <div className="min-w-0">
        <div className="break-words text-xs font-black uppercase tracking-wider leading-tight">
          {display.primary}
        </div>
        {display.secondary && (
          <div className="mt-0.5 break-words text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
            {display.secondary}
          </div>
        )}
      </div>
    </div>
  );
}

function StageBadge({ match }: { match: WorldCupMatch }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
      Match {match.match_number} · {stageLabel(match)}
    </span>
  );
}

function VenueLine({ match }: { match: WorldCupMatch }) {
  if (!match.venue && !match.city) return null;
  return (
    <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
      <MapPin className="h-3 w-3" /> {[match.venue, match.city].filter(Boolean).join(" · ")}
    </div>
  );
}

function UpcomingCard({ match, now }: { match: WorldCupMatch; now: number }) {
  const kickoff = new Date(getKickoff(match));
  const ms = kickoff.getTime() - now;
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <StageBadge match={match} />
        <div className="flex shrink-0 items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {kickoff.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={match.home_flag} name={match.home_team} />
        <div className="min-w-[86px] text-center">
          <div className="font-display text-base font-black tabular-nums text-primary">
            {formatCountdown(ms)}
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            to kickoff
          </div>
        </div>
        <TeamRow flag={match.away_flag} name={match.away_team} align="right" />
      </div>
      <VenueLine match={match} />
    </div>
  );
}

function LiveCard({ match, now }: { match: WorldCupMatch; now: number }) {
  return (
    <div className="glass rounded-2xl border border-destructive p-3">
      <div className="flex items-center justify-between text-[10px]">
        <StageBadge match={match} />
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-destructive-foreground">
          <Radio className="h-2 w-2 animate-pulse" /> Live · {liveMinute(match, now)}'
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={match.home_flag} name={match.home_team} />
        <div className="min-w-[86px] text-center">
          <div className="font-display text-2xl font-black tabular-nums">
            {match.home_score ?? 0}
            <span className="px-1 text-muted-foreground">–</span>
            {match.away_score ?? 0}
          </div>
        </div>
        <TeamRow flag={match.away_flag} name={match.away_team} align="right" />
      </div>
      <VenueLine match={match} />
    </div>
  );
}

function ResultCard({ match }: { match: WorldCupMatch }) {
  const kickoff = new Date(getKickoff(match));
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <StageBadge match={match} />
        <span className="font-bold uppercase tracking-wider">Full time</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={match.home_flag} name={match.home_team} />
        <div className="min-w-[86px] text-center">
          <div className="font-display text-2xl font-black tabular-nums">
            {match.home_score ?? 0}
            <span className="px-1 text-muted-foreground">–</span>
            {match.away_score ?? 0}
          </div>
        </div>
        <TeamRow flag={match.away_flag} name={match.away_team} align="right" />
      </div>
      <div className="mt-2 text-center text-[10px] text-muted-foreground">
        {kickoff.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        {match.venue ? ` · ${match.venue}` : ""}
      </div>
    </div>
  );
}
