import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import {
  WORLD_CUP_STAGES,
  WorldCupFlag,
  WorldCupMatch,
  WorldCupStatus,
  getKickoff,
  stageLabel,
  statusOf,
  validateWorldCup,
} from "@/lib/world-cup";

export const Route = createFileRoute("/_authenticated/admin/worldcup")({
  head: () => ({ meta: [{ title: "World Cup Admin — SAFC" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw redirect({ to: "/login" });
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: WorldCupAdminPage,
});

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function WorldCupAdminPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const matchesQ = useQuery({
    queryKey: ["wc-admin-matches"],
    queryFn: async () => {
      const { data, error } = await db.from("world_cup_matches").select("*").order("match_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorldCupMatch[];
    },
  });

  const flagsQ = useQuery({
    queryKey: ["wc-admin-flags"],
    queryFn: async () => {
      const { data, error } = await db.from("world_cup_country_flags").select("country_name, flag, is_placeholder").order("country_name");
      if (error) throw error;
      return (data ?? []) as WorldCupFlag[];
    },
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["wc-admin-matches"] });
    queryClient.invalidateQueries({ queryKey: ["wc-matches"] });
  };

  const warnings = useMemo(() => validateWorldCup(matchesQ.data ?? [], flagsQ.data ?? []), [matchesQ.data, flagsQ.data]);

  const addBlank = async () => {
    const used = new Set((matchesQ.data ?? []).map((match) => match.match_number));
    const matchNumber = Array.from({ length: 104 }, (_, index) => index + 1).find((number) => !used.has(number)) ?? 104;
    setCreating(true);
    const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db.from("world_cup_matches").insert({
      match_number: matchNumber,
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
    if (error) toast.error(error.message);
    else {
      toast.success(`Match ${matchNumber} added`);
      reload();
    }
  };

  return (
    <PageContainer>
      <AppHeader title="World Cup Admin" />
      <section className="px-4 pt-5">
        <Link to="/worldcup" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to World Cup
        </Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Super Admin</div>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight">Manage 104 Fixtures</h1>
            <p className="mt-1 text-xs text-muted-foreground">Validation checks duplicates, missing slots, flags, venues and kickoff dates.</p>
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
              <AlertTriangle className={warnings.length ? "h-4 w-4 text-destructive" : "h-4 w-4 text-accent"} /> Validation
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {(matchesQ.data ?? []).length}/104 matches · {warnings.length} warnings
            </div>
          </div>
          {warnings.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-muted-foreground">
              {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">All 104 World Cup slots pass validation.</p>
          )}
        </div>
      </section>

      <section className="mt-4 space-y-3 px-4 pb-32">
        {matchesQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {(matchesQ.data ?? []).map((match) => (
          <MatchEditor key={match.id} match={match} flags={flagsQ.data ?? []} onChanged={reload} />
        ))}
      </section>
    </PageContainer>
  );
}

function MatchEditor({ match, flags, onChanged }: { match: WorldCupMatch; flags: WorldCupFlag[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<WorldCupMatch>(match);
  const [saving, setSaving] = useState(false);
  const currentStatus = statusOf(draft, Date.now());
  const flagOptions = flags.filter((flag) => !flag.is_placeholder);

  const update = <K extends keyof WorldCupMatch>(key: K, value: WorldCupMatch[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const syncTeam = (side: "home" | "away", team: string) => {
    const flag = flags.find((item) => item.country_name === team)?.flag ?? "🏳️";
    setDraft((prev) => ({ ...prev, [`${side}_team`]: team, [`${side}_flag`]: flag } as WorldCupMatch));
  };

  const save = async () => {
    setSaving(true);
    const kickoff = new Date(getKickoff(draft)).toISOString();
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
      kickoff,
      kickoff_datetime_utc: kickoff,
      status: currentStatus,
      status_override: draft.status_override,
      home_score: draft.home_score,
      away_score: draft.away_score,
      winner: draft.winner,
    };
    const { error } = await db.from("world_cup_matches").update(payload).eq("id", draft.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Match ${draft.match_number} saved`);
      onChanged();
    }
  };

  const del = async () => {
    if (!confirm(`Delete match ${draft.match_number}? This will make validation warn about a missing slot.`)) return;
    const { error } = await db.from("world_cup_matches").delete().eq("id", draft.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Match deleted");
      onChanged();
    }
  };

  return (
    <div className="glass space-y-3 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wider">Match {draft.match_number} · {stageLabel(draft)}</div>
        <div className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          {draft.status_override ? `Override: ${draft.status_override}` : `Auto: ${currentStatus}`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Match #"><input type="number" min={1} max={104} value={draft.match_number} onChange={(e) => update("match_number", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Stage"><select value={draft.stage} onChange={(e) => update("stage", e.target.value)} className={inputCls}>{WORLD_CUP_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></Field>
        <Field label="Group"><input value={draft.group_name ?? ""} onChange={(e) => update("group_name", e.target.value || null)} className={inputCls} /></Field>
        <Field label="Kickoff UTC"><input type="datetime-local" value={toLocalInput(getKickoff(draft))} onChange={(e) => update("kickoff_datetime_utc", new Date(e.target.value).toISOString())} className={inputCls} /></Field>
        <Field label="Status override"><select value={draft.status_override ?? ""} onChange={(e) => update("status_override", (e.target.value || null) as WorldCupStatus | null)} className={inputCls}><option value="">Automatic</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="finished">Finished</option></select></Field>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home team"><input list="wc-flags" value={draft.home_team} onChange={(e) => syncTeam("home", e.target.value)} className={inputCls} /></Field>
        <Field label="Home flag"><input value={draft.home_flag} onChange={(e) => update("home_flag", e.target.value)} className={inputCls} /></Field>
        <Field label="Away team"><input list="wc-flags" value={draft.away_team} onChange={(e) => syncTeam("away", e.target.value)} className={inputCls} /></Field>
        <Field label="Away flag"><input value={draft.away_flag} onChange={(e) => update("away_flag", e.target.value)} className={inputCls} /></Field>
      </div>
      <datalist id="wc-flags">{flagOptions.map((flag) => <option key={flag.country_name} value={flag.country_name} />)}</datalist>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home score"><input type="number" value={draft.home_score ?? ""} onChange={(e) => update("home_score", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Away score"><input type="number" value={draft.away_score ?? ""} onChange={(e) => update("away_score", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Winner"><input value={draft.winner ?? ""} onChange={(e) => update("winner", e.target.value || null)} className={inputCls} /></Field>
        <Field label="Venue"><input value={draft.venue ?? ""} onChange={(e) => update("venue", e.target.value || null)} className={inputCls} /></Field>
      </div>
      <Field label="City"><input value={draft.city ?? ""} onChange={(e) => update("city", e.target.value || null)} className={inputCls} /></Field>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={del} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-[11px] font-black uppercase tracking-wider text-destructive-foreground hover:opacity-90">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
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