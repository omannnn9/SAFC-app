import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAuthenticatedSupabase } from "@/lib/server-auth";

// Block SSRF: reject loopback, link-local, private, and cloud-metadata IPs.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h.startsWith("[::1") || h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4 dotted-quad checks
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud IMDS
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

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
  .inputValidator((d) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    // Require sign-in to prevent unauthenticated SSRF abuse.
    await requireAuthenticatedSupabase();
    const url = data.url;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid url");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid url");
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error("Blocked host");
    }
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
