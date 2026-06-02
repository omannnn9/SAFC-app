import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Trophy, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getMatch, type MatchTeam } from "@/lib/data";

export const Route = createFileRoute("/fixtures/$id")({
  head: () => ({ meta: [{ title: "Match — Bafana" }] }),
  component: MatchPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load match: {error.message}</div>
  ),
});

function MatchPage() {
  const { id } = Route.useParams();
  const { data: m, isLoading } = useQuery({ queryKey: ["match", id], queryFn: () => getMatch(id) });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!m) throw notFound();
  const k = new Date(m.kickoff);

  return (
    <PageContainer>
      <AppHeader title="Match" />
      <div className="px-4 pt-3">
        <Link to="/fixtures" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> All fixtures
        </Link>
      </div>

      <section className="px-4 pt-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary">{m.competition}</div>
        <div className="mt-2 flex items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-[var(--sa-green)]/40 via-black to-black p-5">
          <Side team={m.home_team} />
          {m.status === "completed" ? (
            <div className="font-display text-4xl font-black tabular-nums">
              {m.home_score}–{m.away_score}
            </div>
          ) : (
            <div className="font-display text-lg font-bold text-muted-foreground">VS</div>
          )}
          <Side team={m.away_team} />
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface/60 p-4 text-sm">
          <Row icon={<Calendar className="h-4 w-4" />} label="Kick-off">
            <div className="flex flex-col gap-0.5">
              <div className="tabular-nums">
                {k.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", timeZone: "Africa/Johannesburg" })} ·{" "}
                {k.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" })} <span className="text-muted-foreground">SAST</span>
              </div>
              {-k.getTimezoneOffset() !== 120 && (
                <div className="text-xs text-muted-foreground tabular-nums">
                  {k.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {k.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })} your time
                </div>
              )}
            </div>
          </Row>

          <Row icon={<MapPin className="h-4 w-4" />} label="Venue">
            {m.venue}
          </Row>
          <Row icon={<Trophy className="h-4 w-4" />} label="Competition">
            {m.competition}
          </Row>
        </div>

        {m.url && (
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] text-primary"
          >
            View on SAFA Match Centre <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </section>
    </PageContainer>
  );
}

function Side({ team }: { team: MatchTeam }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-black/40">
        {team.logo ? (
          <img src={team.logo} alt={team.name} className="h-16 w-16 object-contain" />
        ) : (
          <span className="font-display text-sm font-black">{team.name.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="max-w-[110px] text-center text-xs font-semibold">{team.name}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}
