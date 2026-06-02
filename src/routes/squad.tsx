import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getPlayers, type Player } from "@/lib/data";

export const Route = createFileRoute("/squad")({
  head: () => ({ meta: [{ title: "Squad — Bafana Bafana" }] }),
  component: SquadPage,
});

const FILTERS: { key: Player["position"] | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "GK", label: "Goalkeepers" },
  { key: "DEF", label: "Defenders" },
  { key: "MID", label: "Midfielders" },
  { key: "FWD", label: "Forwards" },
];

function SquadPage() {
  const [pos, setPos] = useState<Player["position"] | "ALL">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["players"], queryFn: getPlayers });
  const filtered = (data ?? []).filter((p) => pos === "ALL" || p.position === pos);

  return (
    <PageContainer>
      <AppHeader title="Squad" />
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">The Squad</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} players · Bafana Bafana
        </p>
      </div>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPos(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              pos === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface/60 text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="px-4 pt-4 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4 pt-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                to="/squad/$id"
                params={{ id: p.id }}
                className="group block overflow-hidden rounded-2xl border border-border bg-surface/60 transition hover:border-primary/40"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-[var(--sa-green)]/60 to-black">
                  <div className="absolute right-2 top-2 rounded-md bg-black/40 px-2 py-1 text-[10px] font-bold text-primary backdrop-blur">
                    {p.position}
                  </div>
                  <div className="absolute left-2 top-2 font-display text-3xl font-black text-white/15">
                    {p.jersey_number}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface to-transparent p-3">
                    <div className="font-display text-sm font-bold leading-tight">{p.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{p.club}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 text-center">
                  <Mini v={p.caps} l="Caps" />
                  <Mini v={p.goals} l="Gls" />
                  <Mini v={p.assists} l="Ast" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function Mini({ v, l }: { v: number; l: string }) {
  return (
    <div className="py-1.5">
      <div className="font-display text-sm font-bold">{v}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
