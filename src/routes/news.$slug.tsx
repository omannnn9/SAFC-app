import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Bookmark, ArrowLeft, ExternalLink, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getArticle, getNews, type Article } from "@/lib/data";
import { getArticleContent } from "@/lib/news.functions";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/news/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Bafana News` }] }),
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load article: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Article not found.</div>
  ),
});

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&q=80";

function HeroImg({ src, alt }: { src: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={!src || err ? FALLBACK_IMG : src}
      alt={alt}
      onError={() => setErr(true)}
      className="h-full w-full object-cover"
    />
  );
}

function ArticlePage() {
  const { slug } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticle(slug),
  });

  const { data: related } = useQuery({
    queryKey: ["related", slug],
    enabled: !!article,
    queryFn: async () => {
      const all = await getNews();
      return all.filter((a) => a.slug !== slug).slice(0, 4);
    },
  });

  const { data: fullContent, isLoading: fullLoading } = useQuery({
    queryKey: ["article-content", article?.url],
    enabled: !!article?.url,
    staleTime: 1000 * 60 * 60,
    queryFn: () => getArticleContent({ data: { url: article!.url! } }),
  });

  const { data: bookmarked } = useQuery({
    queryKey: ["bookmark", slug, user?.id],
    enabled: !!user && !!article,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("article_id", article!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleBm = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to bookmark");
      if (!article) return;
      if (bookmarked) {
        await supabase.from("bookmarks").delete().eq("article_id", article.id).eq("user_id", user.id);
      } else {
        await supabase.from("bookmarks").insert({ article_id: article.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmark", slug] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!article) throw notFound();

  const locked = article.is_premium && !profile?.is_premium;

  return (
    <PageContainer>
      <AppHeader title="News" />
      <div className="px-4 pt-3">
        <Link to="/news" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> All news
        </Link>
      </div>

      <article className="px-4 pt-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-primary">{article.category}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight">
          {article.title}
        </h1>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(article.published_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}

            {article.source && <span className="ml-2">· {article.source}</span>}
          </span>
          <button
            onClick={() => toggleBm.mutate()}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              bookmarked
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface/60"
            }`}
          >
            <Bookmark className={`h-3 w-3 ${bookmarked ? "fill-primary" : ""}`} /> Save
          </button>
        </div>

        <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl">
          <HeroImg src={article.cover_url} alt={article.title} />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{article.excerpt}</p>

        {locked ? (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center">
            <Lock className="mx-auto h-6 w-6 text-primary" />
            <div className="mt-2 font-display text-lg font-bold">Premium content</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock the full story with Bafana Premium Pass.
            </p>
            <Link
              to="/account"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
            >
              Upgrade
            </Link>
          </div>
        ) : (
          <>
            {fullContent?.html ? (
              <div
                className="article-body mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: fullContent.html }}
              />
            ) : fullLoading ? (
              <div className="mt-6 space-y-3">
                <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-10/12 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-9/12 animate-pulse rounded bg-muted/40" />
              </div>
            ) : (
              article.body &&
              article.body !== article.excerpt && (
                <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {article.body.replace(/\s*\[\+\d+ chars\]\s*$/, "")}
                </div>
              )
            )}
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
              >
                Read full article on {article.source ?? "source"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        )}

        {related && related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-bold">Related news</h2>
            <ul className="mt-3 space-y-3">
              {related.map((a) => (
                <li key={a.id}>
                  <RelatedCard a={a} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </PageContainer>
  );
}

function RelatedCard({ a }: { a: Article }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: a.slug }}
      className="glass flex gap-3 overflow-hidden rounded-xl p-2 transition hover:ring-glow-gold"
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg">
        <HeroImg src={a.cover_url} alt={a.title} />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="text-[10px] uppercase tracking-wider text-primary">{a.category}</div>
        <div className="line-clamp-2 font-display text-sm font-bold leading-snug">{a.title}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {new Date(a.published_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {a.source && ` · ${a.source}`}
        </div>
      </div>
    </Link>
  );
}
