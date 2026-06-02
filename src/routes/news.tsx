import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getNews, type Article } from "@/lib/data";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [{ title: "News — Bafana Supporters Club" }] }),
  component: NewsPage,
});

const CATEGORIES: { key: Article["category"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "team", label: "Team" },
  { key: "match", label: "Match" },
  { key: "player", label: "Players" },
  { key: "supporter", label: "Supporters" },
];

function NewsPage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["key"]>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["news", cat],
    queryFn: () => getNews(cat === "all" ? undefined : cat),
  });

  return (
    <PageContainer>
      <AppHeader title="News" />
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">News</h1>
        <p className="text-sm text-muted-foreground">Updates from the camp.</p>
      </div>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              cat === c.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface/60 text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="space-y-3 px-4 pt-3">
        {isLoading && <li className="text-sm text-muted-foreground">Loading…</li>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <li className="rounded-xl border border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
            No articles yet.
          </li>
        )}
        {(data ?? []).map((a) => (
          <li key={a.id}>
            <Link
              to="/news/$slug"
              params={{ slug: a.slug }}
              className="block overflow-hidden rounded-2xl border border-border bg-surface/60 transition hover:border-primary/40"
            >
              <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-[var(--sa-green)] to-black">
                {a.is_premium && (
                  <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    <Lock className="h-3 w-3" /> Premium
                  </div>
                )}
                <div className="absolute inset-0 grid place-items-center font-display text-6xl font-bold opacity-10">
                  {a.category[0].toUpperCase()}
                </div>
              </div>
              <div className="p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary">
                  {a.category}
                </div>
                <div className="mt-1 line-clamp-2 font-display text-lg font-bold leading-snug">
                  {a.title}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {new Date(a.published_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
