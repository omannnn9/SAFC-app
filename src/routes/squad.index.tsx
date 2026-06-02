import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getManager, getPlayers, type Manager, type Player } from "@/lib/data";

export const Route = createFileRoute("/squad/")({
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

function SquadPage() {
  const [pos, setPos] = useState<Player["position"] | "ALL">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["players"], queryFn: getPlayers });
  const { data: manager } = useQuery({ queryKey: ["manager"], queryFn: getManager });
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
          {filtered.length} players · Pulled live from safa.net
        </p>
      </div>

      {manager && <ManagerCard manager={manager} />}

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
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                to="/squad/$id"
                params={{ id: p.id }}
                className="group block overflow-hidden rounded-2xl glass transition duration-300 hover:-translate-y-1 ring-glow-gold"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-white to-white/90">
                  {p.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt={p.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-3xl font-black text-black/20">
                      {p.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                  {/* Bottom dark wedge with name + position */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[oklch(0.18_0.05_140)] via-[oklch(0.18_0.05_140)]/85 to-transparent pt-10 pb-3 px-3">
                    <div className="font-display text-sm font-black uppercase tracking-wide leading-tight text-white">
                      {p.name}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/80">
                      {p.flag_url && (
                        <img src={p.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />
                      )}
                      <span className="uppercase tracking-wider">{p.position_label || p.position}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function ManagerCard({ manager }: { manager: Manager }) {
  return (
    <section className="px-4 pt-4">
      <div className="relative overflow-hidden rounded-2xl glass-strong ring-glow-gold">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--sa-gold)_22%,transparent),transparent_58%)]" />
        <div className="relative grid grid-cols-[96px_1fr] items-center gap-4 p-3">
          <div className="relative h-24 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--sa-green)]/45 to-black">
            {manager.photo_url && (
              <img
                src={manager.photo_url}
                alt={manager.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-top"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Head Coach</div>
            <h2 className="mt-1 truncate font-display text-2xl font-black leading-none">{manager.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{manager.nationality ?? "—"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
