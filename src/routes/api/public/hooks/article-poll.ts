import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { broadcast } from "@/lib/push.server";

/**
 * Cron: every 10 min. Notifies subscribers when new news_articles rows appear.
 * First run after deploy will silently seed the seen_articles table so we don't
 * spam users with a backlog of "new" articles.
 */
export const Route = createFileRoute("/api/public/hooks/article-poll")({
  server: {
    handlers: {
      POST: async () => run(),
      GET: async () => run(),
    },
  },
});

async function run() {
  const { data: articles, error } = await supabaseAdmin
    .from("news_articles")
    .select("id, slug, title, excerpt, cover_url, published_at")
    .order("published_at", { ascending: false })
    .limit(20);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!articles?.length) return new Response(JSON.stringify({ checked: 0 }));

  const { count } = await supabaseAdmin
    .from("seen_articles")
    .select("*", { count: "exact", head: true });
  const isFirstRun = (count ?? 0) === 0;

  const events: string[] = [];
  for (const a of articles) {
    const url = `/news/${a.slug}`;
    const { data: exists } = await supabaseAdmin
      .from("seen_articles")
      .select("url")
      .eq("url", url)
      .maybeSingle();
    if (exists) continue;

    await supabaseAdmin.from("seen_articles").insert({ url, title: a.title });

    if (isFirstRun) continue; // Seed only

    // Only notify for articles published in the last 24h
    const ageMs = Date.now() - new Date(a.published_at).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) continue;

    await broadcast(
      "article",
      {
        title: "📰 " + a.title,
        body: a.excerpt?.slice(0, 140) ?? "Tap to read on Bafana Supporters Club",
        url,
        icon: a.cover_url ?? undefined,
        tag: `article-${a.id}`,
      },
      `article:${a.id}`,
    );
    events.push(`article-${a.id}`);
  }

  return new Response(JSON.stringify({ checked: articles.length, events, seeded: isFirstRun }), {
    headers: { "Content-Type": "application/json" },
  });
}
