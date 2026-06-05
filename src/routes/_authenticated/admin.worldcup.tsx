import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { nameToFlag } from "@/lib/flags";

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

    // SAFE admin check (no missing function dependency)
    const { data: roleData, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();

    if (error || !roleData) throw redirect({ to: "/" });
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
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  // FIXED: no assumptions about schema
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
    [matchesQ.data, flagsQ.data]
  );

  const visibleMatches = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (matchesQ.data ?? []).filter((match) => {
      if (stageFilter && match.stage !== stageFilter) return false;
      if (!needle) return true;

      return [
        match.match_number,
        match.home_team,
        match.away_team,
        match.venue,
        match.city,
        stageLabel(match),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [matchesQ.data, search, stageFilter]);

  const addBlank = async () => {
    const used = new Set((matchesQ.data ?? []).map((m) => m.match_number));
    const matchNumber =
      Array.from({ length: 104 }, (_, i) => i + 1).find((n) => !used.has(n)) ?? 104;

    setCreating(true);

    const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from("world_cup_matches").insert([
      {
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
      },
    ]);

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
              Manage 104 Fixtures
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Validation checks duplicates, missing slots, flags, venues and kickoff dates.
            </p>
          </div>

          <button
            onClick={addBlank}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add match
          </button>
        </div>
      </section>

      <section className="mt-4 px-4">
        <div className={`glass rounded-2xl p-3 ${warnings.length ? "border-destructive" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <AlertTriangle
                className={
                  warnings.length ? "h-4 w-4 text-destructive" : "h-4 w-4 text-accent"
                }
              />
              Validation
            </div>

            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {(matchesQ.data ?? []).length}/104 matches · {warnings.length} warnings
            </div>
          </div>

          {warnings.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-muted-foreground">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              All 104 World Cup slots pass validation.
            </p>
          )}
        </div>
      </section>

      <section className="mt-4 space-y-3 px-4 pb-32">
        {matchesQ.isLoading && (
          <div className="glass h-24 animate-pulse rounded-2xl" />
        )}

        {visibleMatches.map((match) => (
          <MatchEditor
            key={match.id}
            match={match}
            flags={flagsQ.data ?? []}
            onChanged={reload}
          />
        ))}
      </section>
    </PageContainer>
  );
}

/* ----------------- Flag Manager FIX ----------------- */

function FlagManager({
  flags,
  onChanged,
}: {
  flags: WorldCupFlag[];
  onChanged: () => void;
}) {
  const [country, setCountry] = useState("");
  const [flag, setFlag] = useState("");
  const [busy, setBusy] = useState(false);

  const verifiedCount = flags.filter((f) => !f.is_placeholder).length;

  const save = async () => {
    const countryName = country.trim();
    const nextFlag = (flag.trim() || nameToFlag(countryName)).trim();

    if (!countryName) return toast.error("Country name is required");
    if (!nextFlag || nextFlag === "🏳️") return toast.error("Add a valid flag");

    setBusy(true);

    // FIXED: no ON CONFLICT dependency
    const existing = await db
      .from("world_cup_country_flags")
      .select("*")
      .eq("country_name", countryName)
      .maybeSingle();

    let error;

    if (existing.data) {
      const res = await db
        .from("world_cup_country_flags")
        .update({ flag: nextFlag, is_placeholder: false })
        .eq("country_name", countryName);

      error = res.error;
    } else {
      const res = await db.from("world_cup_country_flags").insert([
        {
          country_name: countryName,
          flag: nextFlag,
          is_placeholder: false,
        },
      ]);

      error = res.error;
    }

    setBusy(false);

    if (error) return toast.error(error.message);

    setCountry("");
    setFlag("");
    toast.success("Flag mapping saved");
    onChanged();
  };

  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-primary">
        Flag mappings
      </div>

      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {verifiedCount} verified country flags
      </p>

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

        <input
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          placeholder="🇿🇦"
          className={inputCls}
        />

        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase text-primary-foreground"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ----------------- helper ----------------- */

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
