import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ArticleContent = {
  url: string;
  html: string; // sanitized HTML (paragraphs only)
  text: string; // plain text fallback
  cover_url: string | null;
  fetched_at: string;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

function extractArticleHtml(html: string): { html: string; text: string } {
  // Try <article>...</article> first
  let block = "";
  const art = html.match(/<article[\s\S]*?<\/article>/i);
  if (art) block = art[0];
  else {
    // fall back to <main> or body
    const main = html.match(/<main[\s\S]*?<\/main>/i);
    block = main ? main[0] : html;
  }
  // Drop scripts/styles/nav/aside/figure-captions
  block = block
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  // Collect paragraphs and headings
  const parts: string[] = [];
  const re = /<(p|h2|h3|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = decodeEntities(stripTags(m[2]));
    if (inner.length < 20 && tag === "p") continue; // skip tiny paragraphs (ads/captions)
    if (!inner) continue;
    parts.push(`<${tag}>${inner}</${tag}>`);
  }

  const htmlOut = parts.join("\n");
  const textOut = parts.map((p) => stripTags(p)).join("\n\n");
  return { html: htmlOut, text: textOut };
}

async function readCache(key: string) {
  const { data } = await supabaseAdmin
    .from("api_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  return { payload: data.payload as ArticleContent, stale: new Date(data.expires_at).getTime() < Date.now() };
}
async function writeCache(key: string, payload: ArticleContent, ttl: number) {
  await supabaseAdmin.from("api_cache").upsert({
    cache_key: key,
    payload: payload as never,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export const getArticleContent = createServerFn({ method: "GET" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    const url = data.url;
    if (!/^https?:\/\//i.test(url)) throw new Error("Invalid url");
    const key = `article:${url}`;
    const cached = await readCache(key);
    if (cached && !cached.stale) return cached.payload;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BafanaSupportersBot/1.0; +https://bafana.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) throw new Error(`Fetch ${res.status}`);
      const html = await res.text();
      const { html: artHtml, text } = extractArticleHtml(html);
      const payload: ArticleContent = {
        url,
        html: artHtml,
        text,
        cover_url: extractOgImage(html),
        fetched_at: new Date().toISOString(),
      };
      await writeCache(key, payload, 60 * 60 * 24);
      return payload;
    } catch (err) {
      console.error(`[news.functions] getArticleContent failed for ${url}:`, err);
      if (cached) return cached.payload;
      throw err;
    }
  });
