import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Quote } from "lucide-react";
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
        <div className="relative aspect-square w-full bg-gradient-to-br from-white via-white to-[oklch(0.95_0.02_140)]">
          {player.photo_url && (
            <img
              src={player.photo_url}
              alt={player.name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary">
              {player.flag_url && (
                <img src={player.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />
              )}
              <span>{player.position_label || player.position}</span>
            </div>
            <h1 className="mt-1 font-display text-4xl font-bold leading-tight">{player.name}</h1>
            {player.club && <div className="text-sm text-muted-foreground">{player.club}</div>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-4">
        {player.nickname && <Fact label="Nickname" value={player.nickname} />}
        {player.born && <Fact label="Born" value={player.born} />}
        {player.height && <Fact label="Height" value={player.height} />}
        {player.club && <Fact label="Club" value={player.club} />}
        {player.province && <Fact label="Province / School" value={player.province} wide />}
      </section>

      {player.background && (
        <section className="px-4 pt-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Background &amp; Insights
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{player.background}</p>
        </section>
      )}

      {player.quote && (
        <section className="px-4 pt-5">
          <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-[var(--sa-green)]/30 via-black to-black p-4">
            <Quote className="absolute right-3 top-3 h-5 w-5 text-primary/40" />
            <p className="text-sm italic leading-relaxed text-foreground/90">{player.quote}</p>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-surface/60 p-3 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
