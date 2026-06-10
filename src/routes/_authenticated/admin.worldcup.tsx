import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Plus, RefreshCw, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { nameToFlag } from "@/lib/flags";
import { adminSyncWorldCupNow, adminAutoMapWorldCupMatches } from "@/lib/wc-sync.functions";
import {
  WORLD_CUP_STAGES,
  WORLD_CUP_TOTAL_MATCHES,
  type WorldCupFlag,
  type WorldCupMatch,
  type WorldCupStatus,
  getKickoff,
  stageLabel,
  statusOf,
  validateWorldCup,
} from "@/lib/world-cup";

export const Route = createFileRoute("/_authenticated/admin/worldcup")({
  head: () => ({ meta: [{ title: "World Cup Admin — SA FC" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw redirect({ to: "/login" });
    const { data: role } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: WorldCupAdminPage,
});

type WCStage = (typeof WORLD_CUP_STAGES)[number];

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function WorldCupAdminPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"" | WCStage>("");

  const matchesQ = useQuery({
    queryKey: ["wc-admin-matches"],
    queryFn: async () => {
      const { data, error } = await db
        .from("world_cup_matches")
        .select("*")
        .order("match_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorldCupMatch[];
    },
  });

  const flagsQ = useQuery({
    queryKey: ["wc-admin-flags"],
    queryFn: async () => {
      const { data, error } = await db
        .from("world_cup_country_flags")
        .select("country_name, flag, is_placeholder")
        .order("country_name");
      if (error) throw error;
      return (data ?? []) as WorldCupFlag[];
    },
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["wc-admin-matches"] });
    queryClient.invalidateQueries({ queryKey: ["wc-matches"] });
  };

  const warnings = useMemo(
    () => validateWorldCup(matchesQ.data ?? [], flagsQ.data ?? []),
    [matchesQ.data, flagsQ.data],
  );

  const visibleMatches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (matchesQ.data ?? []).filter((match) => {
      if (stageFilter && match.stage !== stageFilter) return false;
      if (!needle) return true;
      return [match.match_number, match.home_team, match.away_team, match.venue, match.city, stageLabel(match)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [matchesQ.data, search, stageFilter]);

  const addBlank = async () => {
    const used = new Set((matchesQ.data ?? []).map((match) => match.match_number));
    const next = Array.from({ length: WORLD_CUP_TOTAL_MATCHES }, (_, i) => i + 1).find((n) => !used.has(n));
    if (!next) {
      toast.error("All 104 match slots are already used");
      return;
    }
    setCreating(true);
    const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db.from("world_cup_matches").insert({
      match_number: next,
      home_team: "TBD",
      away_team: "TBD",
      home_flag: "🏳️",
      away_flag: "🏳️",
      kickoff,
      kickoff_datetime_utc: kickoff,
      venue: "TBD Venue",
      city: "TBD City",
      stage: "group",
      status: "upcoming",
      status_override: null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Match ${next} added`);
    reload();
  };

  return (
    <PageContainer>
      <AppHeader title="World Cup Admin" />
      <section className="px-4 pt-5">
        <Link
          to="/worldcup"
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to World Cup
        </Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Super Admin</div>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight">Manage 104 Fixtures</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Validation checks duplicates, missing slots, flags, venues and kickoff dates.
            </p>
          </div>
          <button
            onClick={addBlank}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add match
          </button>
        </div>
      </section>

      <section className="mt-4 px-4">
        <div className={`glass rounded-2xl p-3 ${warnings.length ? "border-destructive" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <AlertTriangle className={warnings.length ? "h-4 w-4 text-destructive" : "h-4 w-4 text-accent"} />{" "}
              Validation
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {(matchesQ.data ?? []).length}/{WORLD_CUP_TOTAL_MATCHES} matches · {warnings.length} warnings
            </div>
          </div>
          {warnings.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-muted-foreground">
              {warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">All 104 World Cup slots pass validation.</p>
          )}
        </div>
      </section>

      <FootballDataSyncPanel onSynced={reload} />

      <section className="mt-4 space-y-3 px-4">
        <div className="glass grid gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_180px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search match, team, venue, city"
            className={inputCls}
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as "" | WCStage)}
            className={inputCls}
          >
            <option value="">All stages</option>
            {WORLD_CUP_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel({ stage, group_name: null })}
              </option>
            ))}
          </select>
        </div>
        <FlagManager
          flags={flagsQ.data ?? []}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["wc-admin-flags"] })}
        />
      </section>

      <section className="mt-4 space-y-3 px-4 pb-32">
        {matchesQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {matchesQ.error && (
          <div className="glass rounded-2xl p-3 text-xs text-destructive">
            Failed to load matches: {(matchesQ.error as Error).message}
          </div>
        )}
        {visibleMatches.map((match) => (
          <MatchEditor key={match.id} match={match} flags={flagsQ.data ?? []} onChanged={reload} />
        ))}
      </section>
    </PageContainer>
  );
}

function MatchEditor({
  match,
  flags,
  onChanged,
}: {
  match: WorldCupMatch;
  flags: WorldCupFlag[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<WorldCupMatch>(match);
  const [saving, setSaving] = useState(false);
  const currentStatus = statusOf(draft, Date.now());
  const flagOptions = flags.filter((flag) => !flag.is_placeholder);

  const update = <K extends keyof WorldCupMatch>(key: K, value: WorldCupMatch[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const syncTeam = (side: "home" | "away", team: string) => {
    const flag =
      flags.find((item) => item.country_name.toLowerCase() === team.toLowerCase())?.flag ?? nameToFlag(team);
    setDraft((prev) => ({ ...prev, [`${side}_team`]: team, [`${side}_flag`]: flag }) as WorldCupMatch);
  };

  const save = async () => {
    setSaving(true);
    const kickoffIso = new Date(getKickoff(draft)).toISOString();
    const payload = {
      match_number: draft.match_number,
      stage: draft.stage,
      group_name: draft.group_name,
      home_team: draft.home_team,
      away_team: draft.away_team,
      home_flag: draft.home_flag,
      away_flag: draft.away_flag,
      venue: draft.venue,
      city: draft.city,
      kickoff: kickoffIso,
      kickoff_datetime_utc: kickoffIso,
      status: currentStatus,
      status_override: draft.status_override,
      home_score: draft.home_score,
      away_score: draft.away_score,
      winner: draft.winner,
    };
    const { error } = await db.from("world_cup_matches").update(payload).eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Match ${draft.match_number} saved`);
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete match ${draft.match_number}? This will make validation warn about a missing slot.`)) return;
    const { error } = await db.from("world_cup_matches").delete().eq("id", draft.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Match deleted");
    onChanged();
  };

  return (
    <div className="glass space-y-3 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wider">
          Match {draft.match_number} · {stageLabel(draft)}
        </div>
        <div className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          {draft.status_override ? `Override: ${draft.status_override}` : `Auto: ${currentStatus}`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Match #">
          <input
            type="number"
            min={1}
            max={WORLD_CUP_TOTAL_MATCHES}
            value={draft.match_number}
            onChange={(e) => update("match_number", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Stage">
          <select
            value={draft.stage}
            onChange={(e) => update("stage", e.target.value as WCStage)}
            className={inputCls}
          >
            {WORLD_CUP_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Group">
          <input
            value={draft.group_name ?? ""}
            onChange={(e) => update("group_name", e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Kickoff UTC">
          <input
            type="datetime-local"
            value={toLocalInput(getKickoff(draft))}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              update("kickoff_datetime_utc", new Date(v).toISOString());
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Status override">
          <select
            value={draft.status_override ?? ""}
            onChange={(e) =>
              update("status_override", (e.target.value || null) as WorldCupStatus | null)
            }
            className={inputCls}
          >
            <option value="">Automatic</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="finished">Finished</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home team">
          <input
            list="wc-flags"
            value={draft.home_team}
            onChange={(e) => syncTeam("home", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Home flag">
          <input
            value={draft.home_flag}
            onChange={(e) => update("home_flag", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Away team">
          <input
            list="wc-flags"
            value={draft.away_team}
            onChange={(e) => syncTeam("away", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Away flag">
          <input
            value={draft.away_flag}
            onChange={(e) => update("away_flag", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <datalist id="wc-flags">
        {flagOptions.map((flag) => (
          <option key={flag.country_name} value={flag.country_name} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home score">
          <input
            type="number"
            value={draft.home_score ?? ""}
            onChange={(e) =>
              update("home_score", e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputCls}
          />
        </Field>
        <Field label="Away score">
          <input
            type="number"
            value={draft.away_score ?? ""}
            onChange={(e) =>
              update("away_score", e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputCls}
          />
        </Field>
        <Field label="Winner">
          <input
            value={draft.winner ?? ""}
            onChange={(e) => update("winner", e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Venue">
          <input
            value={draft.venue ?? ""}
            onChange={(e) => update("venue", e.target.value || null)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="City">
        <input
          value={draft.city ?? ""}
          onChange={(e) => update("city", e.target.value || null)}
          className={inputCls}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={del}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-[11px] font-black uppercase tracking-wider text-destructive-foreground hover:opacity-90"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </button>
      </div>
    </div>
  );
}

function FlagManager({ flags, onChanged }: { flags: WorldCupFlag[]; onChanged: () => void }) {
  const [country, setCountry] = useState("");
  const [flag, setFlag] = useState("");
  const [busy, setBusy] = useState(false);
  const verifiedCount = flags.filter((item) => !item.is_placeholder).length;

  const save = async () => {
    const countryName = country.trim();
    const nextFlag = (flag.trim() || nameToFlag(countryName)).trim();
    if (!countryName) {
      toast.error("Country name is required");
      return;
    }
    if (!nextFlag || nextFlag === "🏳️") {
      toast.error("Add a valid flag");
      return;
    }
    setBusy(true);
    const { error } = await db.from("world_cup_country_flags").upsert(
      { country_name: countryName, flag: nextFlag, is_placeholder: false },
      { onConflict: "country_name" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCountry("");
    setFlag("");
    toast.success("Flag mapping saved");
    onChanged();
  };

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-primary">Flag mappings</div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {verifiedCount} verified country flags · placeholders ignored in validation.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px_auto]">
        <input
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            if (!flag.trim()) setFlag(nameToFlag(e.target.value));
          }}
          placeholder="Country name"
          className={inputCls}
        />
        <input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇿🇦" className={inputCls} />
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save flag
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FootballDataSyncPanel({ onSynced }: { onSynced: () => void }) {
  const syncNow = useServerFn(adminSyncWorldCupNow);
  const autoMap = useServerFn(adminAutoMapWorldCupMatches);
  const [busy, setBusy] = useState<"sync" | "map" | "remap" | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const mappedQ = useQuery({
    queryKey: ["wc-fd-mapped-count"],
    queryFn: async () => {
      const { count } = await db
        .from("world_cup_matches")
        .select("id", { count: "exact", head: true })
        .not("football_data_match_id", "is", null);
      return count ?? 0;
    },
  });

  const handleSync = async () => {
    setBusy("sync");
    try {
      const r = await syncNow();
      setLast(`${new Date().toLocaleTimeString()} — ${r.scoreUpdates} scores, ${r.statusUpdates} statuses, ${r.placeholderResolutions} placeholders resolved (${r.mapped}/${r.scanned} mapped)`);
      toast.success("Football-Data sync complete");
      onSynced();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleMap = async (remap: boolean) => {
    setBusy(remap ? "remap" : "map");
    try {
      const r = await autoMap({ data: { remap } });
      toast.success(`Mapped ${r.mapped} / ${r.total} matches (skipped ${r.skipped})`);
      onSynced();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 px-4">
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wider">Football-Data live sync</div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Auto-runs every 5 min. Updates scores, status and resolves knockout placeholders. Never deletes matches or touches RSVPs.
            </p>
          </div>
          <div className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            {mappedQ.data ?? 0} mapped
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {busy === "sync" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync now
          </button>
          <button
            onClick={() => handleMap(false)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-foreground disabled:opacity-60"
          >
            {busy === "map" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Auto-map unmapped
          </button>
          <button
            onClick={() => handleMap(true)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-foreground disabled:opacity-60"
          >
            {busy === "remap" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Re-map all
          </button>
        </div>
        {last && <p className="mt-2 text-[10px] text-muted-foreground">{last}</p>}
      </div>
    </section>
  );
}
