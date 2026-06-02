import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Bookmark, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getArticle } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/news/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Bafana News` }] }),
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load article: {error.message}</div>
  ),
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticle(slug),
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
          <span>
            {new Date(article.published_at).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
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

        <div className="mt-4 h-48 rounded-xl bg-gradient-to-br from-[var(--sa-green)] via-black to-black" />

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{article.excerpt}</p>

        {locked ? (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center">
            <Lock className="mx-auto h-6 w-6 text-primary" />
            <div className="mt-2 font-display text-lg font-bold">Premium content</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock the full story with Bafana Premium Pass.
            </p>
            <Link
              to="/premium"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
            >
              Upgrade
            </Link>
          </div>
        ) : (
          <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {article.body}
          </div>
        )}
      </article>
    </PageContainer>
  );
}
