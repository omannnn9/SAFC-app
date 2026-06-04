import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Trophy, Radio, CalendarDays, MapPin, Settings } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const Route = createFileRoute("/worldcup")({
  head: () => ({
    meta: [
      { title: "FIFA World Cup 2026 — SAFC" },
      { name: "description", content: "Every World Cup 2026 fixture, live match and result." },
    ],
  }),
  component: WorldCupPage,
});

type WcMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  kickoff: string;
  venue: string | null;
  city: string | null;
  stage: string;
  group_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

type Status = "upcoming" | "live" | "finished";

const MATCH_DURATION_MS = 120 * 60 * 1000;

function statusOf(m: WcMatch, now: number): Status {
  const ko = new Date(m.kickoff).getTime();
  if (now < ko) return "upcoming";
  if (now <= ko + MATCH_DURATION_MS) return "live";
  return "finished";
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Kickoff!";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function liveMinute(m: WcMatch, now: number) {
  const ko = new Date(m.kickoff).getTime();
  const mins = Math.floor((now - ko) / 60000);
  return Math.max(1, Math.min(mins, 120));
}

function WorldCupPage() {
  const { user } = useAuth();
  const now = useNow(1000);
  const [tab, setTab] = useState<"upcoming" | "live" | "results">("upcoming");

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
      const { data } = await db
        .from("world_cup_matches")
        .select("*")
        .order("kickoff", { ascending: true });
      return (data ?? []) as WcMatch[];
    },
    refetchInterval: 30_000,
  });

  const { upcoming, live, finished } = useMemo(() => {
    const list = matchesQ.data ?? [];
    const u: WcMatch[] = [];
    const l: WcMatch[] = [];
    const f: WcMatch[] = [];
    for (const m of list) {
      const s = statusOf(m, now);
      if (s === "upcoming") u.push(m);
      else if (s === "live") l.push(m);
      else f.push(m);
    }
    f.reverse();
    return { upcoming: u, live: l, finished: f };
  }, [matchesQ.data, now]);

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
              Every match. Every <span className="text-gradient-gold">supporter</span>.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fully internal fixture engine — countdowns, live windows, and results all update on
              their own.
            </p>
          </div>
          {isAdminQ.data && (
            <Link
              to="/admin/worldcup"
              className="glass flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider text-foreground hover:bg-white/5"
            >
              <Settings className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-3 rounded-xl p-1">
          {([
            { id: "upcoming", label: `Upcoming · ${upcoming.length}` },
            { id: "live", label: live.length ? `Live · ${live.length}` : "Live" },
            { id: "results", label: `Results · ${finished.length}` },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setTab(f.id)}
              className={`rounded-lg py-2 text-[10px] font-black uppercase tracking-wider transition ${
                tab === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {f.id === "live" && live.length > 0 && (
                <Radio className="mr-1 inline h-2.5 w-2.5 animate-pulse text-red-400" />
              )}
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 px-4 pb-32">
        {matchesQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}

        {!matchesQ.isLoading && tab === "upcoming" && upcoming.length === 0 && (
          <EmptyState text="No upcoming matches." />
        )}
        {tab === "upcoming" &&
          upcoming.map((m) => <UpcomingCard key={m.id} m={m} now={now} />)}

        {!matchesQ.isLoading && tab === "live" && live.length === 0 && (
          <EmptyState text="No matches are live right now. Check back at kickoff." />
        )}
        {tab === "live" && live.map((m) => <LiveCard key={m.id} m={m} now={now} />)}

        {!matchesQ.isLoading && tab === "results" && finished.length === 0 && (
          <EmptyState text="No finished matches yet." />
        )}
        {tab === "results" && finished.map((m) => <ResultCard key={m.id} m={m} />)}
      </section>
    </PageContainer>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
      <Trophy className="mx-auto mb-2 h-6 w-6 text-[var(--sa-gold)]" />
      {text}
    </div>
  );
}

function TeamRow({ flag, name, align = "left" }: { flag: string; name: string; align?: "left" | "right" }) {
  return (
    <div
      className={`flex flex-1 items-center gap-2 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className="text-2xl leading-none">{flag}</span>
      <div className="min-w-0 truncate text-xs font-black uppercase tracking-wider">{name}</div>
    </div>
  );
}

function StageBadge({ m }: { m: WcMatch }) {
  const label =
    m.stage === "group"
      ? `Group ${m.group_name ?? ""}`.trim()
      : m.stage === "r32"
      ? "Round of 32"
      : m.stage === "r16"
      ? "Round of 16"
      : m.stage === "qf"
      ? "Quarter Final"
      : m.stage === "sf"
      ? "Semi Final"
      : m.stage === "third"
      ? "Third Place"
      : m.stage === "final"
      ? "Final"
      : m.stage;
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

function UpcomingCard({ m, now }: { m: WcMatch; now: number }) {
  const ko = new Date(m.kickoff);
  const ms = ko.getTime() - now;
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <StageBadge m={m} />
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {ko.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={m.home_flag} name={m.home_team} />
        <div className="min-w-[78px] text-center">
          <div className="font-display text-base font-black tabular-nums text-primary">
            {formatCountdown(ms)}
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            to kickoff
          </div>
        </div>
        <TeamRow flag={m.away_flag} name={m.away_team} align="right" />
      </div>
      {(m.venue || m.city) && (
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> {[m.venue, m.city].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function LiveCard({ m, now }: { m: WcMatch; now: number }) {
  return (
    <div className="glass rounded-2xl border border-red-500/30 p-3">
      <div className="flex items-center justify-between text-[10px]">
        <StageBadge m={m} />
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400">
          <Radio className="h-2 w-2 animate-pulse" /> Live · {liveMinute(m, now)}'
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={m.home_flag} name={m.home_team} />
        <div className="min-w-[78px] text-center">
          <div className="font-display text-2xl font-black tabular-nums">
            {m.home_score ?? 0}<span className="px-1 text-muted-foreground">–</span>{m.away_score ?? 0}
          </div>
        </div>
        <TeamRow flag={m.away_flag} name={m.away_team} align="right" />
      </div>
      {(m.venue || m.city) && (
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> {[m.venue, m.city].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function ResultCard({ m }: { m: WcMatch }) {
  const ko = new Date(m.kickoff);
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <StageBadge m={m} />
        <span className="font-bold uppercase tracking-wider">Full time</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <TeamRow flag={m.home_flag} name={m.home_team} />
        <div className="min-w-[78px] text-center">
          <div className="font-display text-2xl font-black tabular-nums">
            {m.home_score ?? 0}<span className="px-1 text-muted-foreground">–</span>{m.away_score ?? 0}
          </div>
        </div>
        <TeamRow flag={m.away_flag} name={m.away_team} align="right" />
      </div>
      <div className="mt-2 text-center text-[10px] text-muted-foreground">
        {ko.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        {m.venue ? ` · ${m.venue}` : ""}
      </div>
    </div>
  );
}
