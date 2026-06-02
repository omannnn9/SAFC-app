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
  { key: "GK", label: "GK" },
  { key: "DEF", label: "DEF" },
  { key: "MID", label: "MID" },
  { key: "FWD", label: "FWD" },
];

const POS_RING: Record<Player["position"], string> = {
  GK: "ring-glow-blue",
  DEF: "ring-glow-green",
  MID: "ring-glow-gold",
  FWD: "ring-glow-red",
};
const POS_GRAD: Record<Player["position"], string> = {
  GK: "from-[oklch(0.5_0.18_240)]/50 to-black",
  DEF: "from-[var(--sa-green)]/50 to-black",
  MID: "from-[var(--sa-gold)]/40 to-black",
  FWD: "from-[var(--sa-red)]/45 to-black",
};

function rating(p: Player) {
  return Math.min(99, 60 + p.caps + p.goals * 2 + p.assists);
}

function SquadPage() {
  const [pos, setPos] = useState<Player["position"] | "ALL">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["players"], queryFn: getPlayers });
  const filtered = (data ?? []).filter((p) => pos === "ALL" || p.position === pos);

  return (
    <PageContainer>
      <AppHeader title="Squad" />
      <div className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          National Team
        </div>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight">
          The <span className="text-gradient-gold">Squad</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered.length} players · FIFA player card view
        </p>
      </div>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPos(f.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              pos === f.key
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-gold)]"
                : "glass text-muted-foreground hover:text-foreground"
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
          {filtered.map((p) => {
            const r = rating(p);
            return (
              <li key={p.id}>
                <Link
                  to="/squad/$id"
                  params={{ id: p.id }}
                  className={`group block overflow-hidden rounded-2xl glass transition duration-300 hover:-translate-y-1 ${POS_RING[p.position]}`}
                >
                  <div className={`relative aspect-[3/4] overflow-hidden bg-gradient-to-br ${POS_GRAD[p.position]}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
                    {/* rating tile */}
                    <div className="absolute left-2 top-2 flex flex-col items-center leading-none">
                      <div className="font-display text-2xl font-black text-white drop-shadow">{r}</div>
                      <div className="mt-0.5 text-[9px] font-bold tracking-wider text-white/80">
                        {p.position}
                      </div>
                      <div className="mt-1 h-[1px] w-5 bg-white/40" />
                      <div className="mt-1 text-[10px]">🇿🇦</div>
                    </div>
                    {/* jersey number giant */}
                    <div className="absolute right-1 top-0 font-display text-[80px] font-black text-white/10 leading-none">
                      {p.jersey_number}
                    </div>
                    {/* player silhouette */}
                    <div className="absolute inset-x-0 bottom-0 grid place-items-center">
                      <div className="grid h-24 w-24 place-items-center rounded-full bg-white/5 mb-8 font-display text-3xl font-black text-white/30">
                        {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                      <div className="font-display text-sm font-black uppercase tracking-wide leading-tight">
                        {p.name}
                      </div>
                      <div className="truncate text-[9px] uppercase tracking-wider text-white/60">
                        {p.club}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 bg-black/40 text-center">
                    <Mini v={p.caps} l="Caps" />
                    <Mini v={p.goals} l="Gls" />
                    <Mini v={p.assists} l="Ast" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}

function Mini({ v, l }: { v: number; l: string }) {
  return (
    <div className="py-1.5">
      <div className="font-display text-sm font-black">{v}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
