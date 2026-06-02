import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Clock } from "lucide-react";
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
  const [highOnly, setHighOnly] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["news", cat],
    queryFn: () => getNews(cat === "all" ? undefined : cat),
    refetchInterval: 1000 * 60 * 20,
    staleTime: 1000 * 60 * 15,
  });

  const filtered = (data ?? []).filter((a) => (highOnly ? a.relevance === "high" : true));
  const [hero, ...rest] = filtered.length ? filtered : (data ?? []);

  return (
    <PageContainer>
      <AppHeader title="News" />
      <div className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Newsroom</div>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight">
          The <span className="text-gradient-gold">latest</span>
        </h1>
      </div>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              cat === c.key
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-gold)]"
                : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setHighOnly((v) => !v)}
          className={`ml-auto shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
            highOnly
              ? "bg-primary/20 text-primary ring-1 ring-primary/40"
              : "glass text-muted-foreground"
          }`}
          title="Show only high-relevance Bafana stories"
        >
          {highOnly ? "Top stories" : "All"}
        </button>
      </div>

      <div className="space-y-4 px-4 pt-3">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
            {highOnly ? "No high-relevance stories right now." : "No articles yet."}
          </div>
        )}

        {hero && <HeroArticle a={hero} />}

        <ul className="space-y-3">
          {rest.map((a) => (
            <li key={a.id}>
              <FeedCard a={a} />
            </li>
          ))}
        </ul>
      </div>
    </PageContainer>
  );
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&q=80";

function ArticleImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  const url = !src || err ? FALLBACK_IMG : src;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className={className}
    />
  );
}

function HeroArticle({ a }: { a: Article }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: a.slug }}
      className="group glass relative block aspect-[4/5] overflow-hidden rounded-2xl ring-glow-gold"
    >
      <ArticleImage
        src={a.cover_url}
        alt={a.title}
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <RelevanceBadge r={a.relevance} />
        {a.is_premium && (
          <div className="inline-flex items-center gap-1 rounded-full shimmer-gold px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black">
            <Lock className="h-3 w-3" /> Premium
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Featured · {a.category}
        </div>
        <div className="mt-2 font-display text-2xl font-black leading-tight">{a.title}</div>
        <div className="mt-1 line-clamp-2 text-xs text-foreground/70">{a.excerpt}</div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />{" "}
          {new Date(a.published_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
          {a.source && <span className="ml-2">· {a.source}</span>}
        </div>
      </div>
    </Link>
  );
}

function FeedCard({ a }: { a: Article }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: a.slug }}
      className="group glass relative block overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:ring-glow-gold"
    >
      <div className="relative h-44 w-full overflow-hidden">
        <ArticleImage
          src={a.cover_url}
          alt={a.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <RelevanceBadge r={a.relevance} small />
          {a.is_premium && (
            <div className="inline-flex items-center gap-1 rounded-full shimmer-gold px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
              <Lock className="h-2.5 w-2.5" /> Premium
            </div>
          )}
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {a.category}
          </div>
          <div className="line-clamp-2 font-display text-base font-black leading-tight">
            {a.title}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between p-3 text-[10px] text-muted-foreground">
        <span className="line-clamp-1">{a.source ?? a.excerpt}</span>
        <span className="ml-2 shrink-0">
          {new Date(a.published_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
        </span>
      </div>
    </Link>
  );
}
