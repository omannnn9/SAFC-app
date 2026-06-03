import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Trophy, Radio, CalendarDays, Loader2, Download, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/social";
import { importWorldCupFixtures, refreshLiveScores } from "@/lib/worldcup.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/worldcup")({
  head: () => ({ meta: [
    { title: "FIFA World Cup 2026 — Bafana Connect" },
    { name: "description", content: "Every FIFA World Cup 2026 match as a living supporter community. Find who's going, share photos, plan travel." },
  ] }),
  component: WorldCupPage,
});

const STAGES = [
  { id: "group", name: "Group Stage" },
  { id: "r32", name: "Round of 32" },
  { id: "r16", name: "Round of 16" },
  { id: "qf", name: "Quarter Finals" },
  { id: "sf", name: "Semi Finals" },
  { id: "third", name: "Third Place" },
  { id: "final", name: "Final" },
] as const;

function WorldCupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "finished">("all");

  const isAdminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const matchesQ = useQuery({
    queryKey: ["wc-matches"],
    queryFn: async () => {
      const { data } = await db.from("events").select("*").eq("event_type", "wc_match").order("kickoff", { ascending: true });
      return (data ?? []) as EventRow[];
    },
    refetchInterval: 30_000,
  });

  const importFn = useServerFn(importWorldCupFixtures);
  const refreshFn = useServerFn(refreshLiveScores);
  const [busy, setBusy] = useState<"import" | "refresh" | null>(null);

  const grouped = useMemo(() => {
    const list = (matchesQ.data ?? []).filter((m) => {
      if (filter === "live") return m.status === "live";
      if (filter === "upcoming") return m.status === "scheduled";
      if (filter === "finished") return m.status === "finished";
      return true;
    });
    const map = new Map<string, EventRow[]>();
    for (const m of list) {
      const key = m.stage ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [matchesQ.data, filter]);

  const liveCount = (matchesQ.data ?? []).filter((m) => m.status === "live").length;

  const runImport = async () => {
    setBusy("import");
    try {
      const res = await importFn();
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["wc-matches"] });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };
  const runRefresh = async () => {
    setBusy("refresh");
    try {
      const res = await refreshFn({ data: { live: true } });
      toast.success(`Refreshed ${res.updated} live matches`);
      qc.invalidateQueries({ queryKey: ["wc-matches"] });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  return (
    <PageContainer>
      <AppHeader title="World Cup" />

      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">FIFA World Cup 2026</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Every match. Every <span className="text-gradient-gold">supporter</span>.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Each match is a living community. Find who's going, share photos, plan travel.</p>
      </section>

      {isAdminQ.data && (
        <section className="mt-3 px-4">
          <div className="glass flex flex-wrap gap-2 rounded-2xl p-3">
            <button onClick={runImport} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
              {busy === "import" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Import 2026 fixtures
            </button>
            <button onClick={runRefresh} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-60">
              {busy === "refresh" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh live scores
            </button>
          </div>
        </section>
      )}

      <section className="mt-4 px-4">
        <div className="glass grid grid-cols-4 rounded-xl p-1">
          {([
            { id: "all", label: `All · ${matchesQ.data?.length ?? 0}` },
            { id: "live", label: liveCount ? `Live · ${liveCount}` : "Live" },
            { id: "upcoming", label: "Upcoming" },
            { id: "finished", label: "Finished" },
          ] as const).map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-lg py-2 text-[10px] font-black uppercase tracking-wider ${filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {f.id === "live" && liveCount > 0 && <Radio className="mr-1 inline h-2.5 w-2.5 text-red-400" />}
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 pb-32 space-y-5 px-4">
        {matchesQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {!matchesQ.isLoading && (matchesQ.data?.length ?? 0) === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            <Trophy className="mx-auto mb-2 h-6 w-6 text-[var(--sa-gold)]" />
            No World Cup matches yet. {isAdminQ.data ? "Click \"Import 2026 fixtures\" above to seed every match." : "Check back closer to the tournament."}
          </div>
        )}
        {STAGES.map((s) => {
          const list = grouped.get(s.id);
          if (!list?.length) return null;
          return (
            <div key={s.id}>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3 text-primary" /> {s.name} · {list.length}</h2>
              <div className="space-y-2">
                {list.map((m) => <WcCard key={m.id} m={m} onClick={() => navigate({ to: "/events/$id", params: { id: m.id } })} />)}
              </div>
            </div>
          );
        })}
      </section>
    </PageContainer>
  );
}

function WcCard({ m, onClick }: { m: EventRow; onClick: () => void }) {
  const date = new Date(m.kickoff);
  const isLive = m.status === "live";
  const isFin = m.status === "finished";
  return (
    <button onClick={onClick} className="glass w-full rounded-2xl p-3 text-left transition hover:bg-white/5">
      <div className="flex items-center gap-3">
        <Team flag={m.home_team_flag} name={m.home_team ?? "TBD"} />
        <div className="min-w-[64px] text-center">
          {isLive || isFin ? (
            <div className="font-display text-xl font-black">{m.home_score ?? 0}–{m.away_score ?? 0}</div>
          ) : (
            <div className="font-display text-base font-black text-muted-foreground">{date.toLocaleString(undefined, { day: "numeric", month: "short" })}<br /><span className="text-[10px] font-bold text-muted-foreground">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
          )}
          {isLive && <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400"><Radio className="h-2 w-2 animate-pulse" /> {m.minute ?? 0}'</div>}
          {isFin && <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">FT</div>}
        </div>
        <Team flag={m.away_team_flag} name={m.away_team ?? "TBD"} />
      </div>
      {(m.venue || m.city) && <div className="mt-2 text-center text-[10px] text-muted-foreground">{[m.venue, m.city].filter(Boolean).join(" · ")}</div>}
    </button>
  );
}
function Team({ flag, name }: { flag: string | null; name: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 min-w-0">
      {flag ? <img src={flag} alt={name} className="h-7 w-7 rounded-full object-cover ring-1 ring-border" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-[10px]">{name.slice(0, 2)}</div>}
      <div className="min-w-0 truncate text-xs font-black uppercase tracking-wider">{name}</div>
    </div>
  );
}
