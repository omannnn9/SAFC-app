import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/worldcup")({
  head: () => ({ meta: [{ title: "World Cup Admin — SAFC" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw redirect({ to: "/login" });
    const { data: roles } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw redirect({ to: "/" });
  },
  component: WorldCupAdminPage,
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

const STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function WorldCupAdminPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const matchesQ = useQuery({
    queryKey: ["wc-admin-matches"],
    queryFn: async () => {
      const { data } = await db
        .from("world_cup_matches")
        .select("*")
        .order("kickoff", { ascending: true });
      return (data ?? []) as WcMatch[];
    },
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["wc-admin-matches"] });
  const reloadPublic = () => qc.invalidateQueries({ queryKey: ["wc-matches"] });

  const addBlank = async () => {
    setCreating(true);
    const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db.from("world_cup_matches").insert({
      home_team: "TBD",
      away_team: "TBD",
      home_flag: "🏳️",
      away_flag: "🏳️",
      kickoff,
      stage: "group",
    });
    setCreating(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Match added");
      reload();
      reloadPublic();
    }
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
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Super Admin
            </div>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
              Manage Fixtures
            </h1>
          </div>
          <button
            onClick={addBlank}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add match
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-3 px-4 pb-32">
        {matchesQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {(matchesQ.data ?? []).map((m) => (
          <MatchEditor key={m.id} match={m} onChanged={() => { reload(); reloadPublic(); }} />
        ))}
      </section>
    </PageContainer>
  );
}

function MatchEditor({ match, onChanged }: { match: WcMatch; onChanged: () => void }) {
  const [m, setM] = useState<WcMatch>(match);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof WcMatch>(k: K, v: WcMatch[K]) => setM((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {
      home_team: m.home_team,
      away_team: m.away_team,
      home_flag: m.home_flag,
      away_flag: m.away_flag,
      kickoff: new Date(m.kickoff).toISOString(),
      venue: m.venue,
      city: m.city,
      stage: m.stage,
      group_name: m.group_name,
      home_score: m.home_score,
      away_score: m.away_score,
    };
    const { error } = await db.from("world_cup_matches").update(payload).eq("id", m.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      onChanged();
    }
  };

  const del = async () => {
    if (!confirm(`Delete ${m.home_team} vs ${m.away_team}?`)) return;
    const { error } = await db.from("world_cup_matches").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      onChanged();
    }
  };

  return (
    <div className="glass space-y-2 rounded-2xl p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home flag">
          <input value={m.home_flag} onChange={(e) => update("home_flag", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Home team">
          <input value={m.home_team} onChange={(e) => update("home_team", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Away flag">
          <input value={m.away_flag} onChange={(e) => update("away_flag", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Away team">
          <input value={m.away_team} onChange={(e) => update("away_team", e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Kickoff (local)">
          <input
            type="datetime-local"
            value={toLocalInput(m.kickoff)}
            onChange={(e) => update("kickoff", new Date(e.target.value).toISOString())}
            className={inputCls}
          />
        </Field>
        <Field label="Stage">
          <select value={m.stage} onChange={(e) => update("stage", e.target.value)} className={inputCls}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Group">
          <input value={m.group_name ?? ""} onChange={(e) => update("group_name", e.target.value || null)} className={inputCls} />
        </Field>
        <Field label="Home / Away score">
          <div className="flex gap-1">
            <input type="number" value={m.home_score ?? ""} onChange={(e) => update("home_score", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} placeholder="—" />
            <input type="number" value={m.away_score ?? ""} onChange={(e) => update("away_score", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} placeholder="—" />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Venue">
          <input value={m.venue ?? ""} onChange={(e) => update("venue", e.target.value || null)} className={inputCls} />
        </Field>
        <Field label="City">
          <input value={m.city ?? ""} onChange={(e) => update("city", e.target.value || null)} className={inputCls} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={del} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/25">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
