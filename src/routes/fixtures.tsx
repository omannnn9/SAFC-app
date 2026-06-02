import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getUpcomingMatches, getPastMatches, type Match } from "@/lib/data";
import { nameToFlag } from "@/lib/flags";

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
      <div className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Broadcast schedule</div>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight">
          Match <span className="text-gradient-gold">timeline</span>
        </h1>
      </div>

      <div className="mt-4 flex gap-2 px-4">
        {(["upcoming", "results"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-gold)]"
                : "glass text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ol className="relative mt-6 px-4">
        {/* timeline rail */}
        <div className="absolute left-9 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
        {list.length === 0 && (
          <li className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </li>
        )}
        {list.map((m, i) => (
          <li key={m.id} className="relative flex gap-4 pb-5">
            <TimelineDot m={m} />
            <div className="flex-1">
              <MatchCard m={m} live={tab === "upcoming" && i === 0} />
            </div>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}

function TimelineDot({ m }: { m: Match }) {
  const k = new Date(m.kickoff);
  const isUpcoming = m.status === "upcoming";
  return (
    <div className="flex w-10 shrink-0 flex-col items-center">
      <div
        className={`relative grid h-10 w-10 place-items-center rounded-full glass ${
          isUpcoming ? "ring-glow-gold" : "opacity-60"
        }`}
      >
        <div className="text-center leading-none">
          <div className="font-display text-[11px] font-black">
            {k.toLocaleDateString("en-ZA", { day: "2-digit" })}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">
            {k.toLocaleDateString("en-ZA", { month: "short" })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m, live }: { m: Match; live?: boolean }) {
  const k = new Date(m.kickoff);
  const home = m.home_team ?? {
    id: m.is_home ? 1097 : null,
    name: m.is_home ? "South Africa" : m.opponent,
    logo: m.is_home ? "https://media.api-sports.io/football/teams/1097.png" : m.opponent_flag,
  };
  const away = m.away_team ?? {
    id: m.is_home ? null : 1097,
    name: m.is_home ? m.opponent : "South Africa",
    logo: m.is_home ? m.opponent_flag : "https://media.api-sports.io/football/teams/1097.png",
  };
  return (
    <Link
      to="/fixtures/$id"
      params={{ id: m.id }}
      className={`group glass relative block overflow-hidden rounded-2xl p-4 transition hover:-translate-y-0.5 ${
        m.status === "upcoming" ? "ring-glow-gold" : ""
      } ${m.status === "completed" ? "opacity-90" : ""}`}
    >
      {live && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--sa-green)] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white live-dot">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live soon
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          {m.competition}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {k.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team logo={home.logo} name={home.name} accent={home.id === 1097} />
        {m.status === "completed" ? (
          <div className="font-display text-3xl font-black tabular-nums">
            <span className={home.id === 1097 ? "text-primary" : ""}>{m.home_score}</span>
            <span className="px-1 text-muted-foreground">–</span>
            <span className={away.id === 1097 ? "text-primary" : ""}>{m.away_score}</span>
          </div>
        ) : (
          <div className="font-display text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            VS
          </div>
        )}
        <Team logo={away.logo} name={away.name} accent={away.id === 1097} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <MapPin className="h-3 w-3" /> {m.venue}
      </div>
    </Link>
  );
}

function Team({ logo, name, accent }: { logo: string | null; name: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`grid h-12 w-12 place-items-center overflow-hidden rounded-xl ${
          accent ? "bg-[var(--sa-green)] ring-glow-green" : "bg-surface-2"
        }`}
      >
        {logo ? (
          <img
            src={logo}
            alt={name}
            loading="lazy"
            className="h-10 w-10 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-xl">🏳️</span>
        )}
      </div>
      <div className="max-w-[88px] truncate text-center font-display text-[10px] font-black uppercase tracking-wider">
        {name}
      </div>
    </div>
  );
}
