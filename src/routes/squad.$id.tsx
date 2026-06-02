import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getPlayer } from "@/lib/data";

export const Route = createFileRoute("/squad/$id")({
  head: () => ({ meta: [{ title: "Player profile — Bafana" }] }),
  component: PlayerPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load player: {error.message}</div>
  ),
});

function PlayerPage() {
  const { id } = Route.useParams();
  const { data: player, isLoading } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!player) throw notFound();

  return (
    <PageContainer>
      <AppHeader title="Squad" />
      <div className="px-4 pt-3">
        <Link to="/squad" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to squad
        </Link>
      </div>

      <section className="relative mt-3 overflow-hidden">
        <div className="aspect-square w-full bg-gradient-to-br from-[var(--sa-green)] via-black to-black">
          <div className="absolute inset-0 grid place-items-center">
            <div className="font-display text-[200px] font-black leading-none text-white/10">
              {player.jersey_number ?? ""}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary">
              {player.position} · #{player.jersey_number}
            </div>
            <h1 className="mt-1 font-display text-4xl font-bold leading-tight">{player.name}</h1>
            <div className="text-sm text-muted-foreground">{player.club}</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 px-4 pt-4">
        <Big label="Caps" value={player.caps} />
        <Big label="Goals" value={player.goals} />
        <Big label="Assists" value={player.assists} />
      </section>

      {player.bio && (
        <section className="px-4 pt-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Biography
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{player.bio}</p>
        </section>
      )}
    </PageContainer>
  );
}

function Big({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
