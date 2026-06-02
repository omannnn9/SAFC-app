import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getUpcomingMatches, getPastMatches, type Match } from "@/lib/data";

export const Route = createFileRoute("/fixtures")({
  head: () => ({ meta: [{ title: "Fixtures & Results — Bafana" }] }),
  component: FixturesPage,
});

function FixturesPage() {
  const [tab, setTab] = useState<"upcoming" | "results">("upcoming");
  const { data: upcoming } = useQuery({ queryKey: ["upcoming-matches"], queryFn: getUpcomingMatches });
  const { data: past } = useQuery({ queryKey: ["past-matches"], queryFn: getPastMatches });
  const list = tab === "upcoming" ? upcoming ?? [] : past ?? [];

  return (
    <PageContainer>
      <AppHeader title="Fixtures" />
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Fixtures</h1>
        <p className="text-sm text-muted-foreground">All Bafana matches.</p>
      </div>

      <div className="mt-4 flex gap-2 px-4">
        {(["upcoming", "results"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface/60 text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="space-y-3 px-4 pt-4">
        {list.length === 0 && (
          <li className="rounded-xl border border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </li>
        )}
        {list.map((m) => (
          <li key={m.id}>
            <MatchCard m={m} />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

function MatchCard({ m }: { m: Match }) {
  const k = new Date(m.kickoff);
  return (
    <Link
      to="/fixtures/$id"
      params={{ id: m.id }}
      className={`block overflow-hidden rounded-2xl border ${
        m.is_home ? "border-primary/30" : "border-border"
      } bg-surface/60 p-4 transition hover:border-primary/50`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-primary">{m.competition}</div>
        <div className="text-[10px] text-muted-foreground">
          {k.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} ·{" "}
          {k.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Team flag="🇿🇦" name="South Africa" home={m.is_home} />
        {m.status === "completed" ? (
          <div className="font-display text-3xl font-bold tabular-nums">
            {m.is_home ? m.home_score : m.away_score} – {m.is_home ? m.away_score : m.home_score}
          </div>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">vs</div>
        )}
        <Team flag="🏳️" name={m.opponent} home={!m.is_home} />
      </div>
      <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" /> {m.venue}
      </div>
    </Link>
  );
}

function Team({ flag, name, home }: { flag: string; name: string; home: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${home ? "" : "opacity-90"}`}>
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-background/60 text-xl">
        {flag}
      </div>
      <div className="max-w-[80px] truncate text-center text-[10px] font-medium">{name}</div>
    </div>
  );
}
