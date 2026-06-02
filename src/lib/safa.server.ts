// SAFA Match Centre = the "truth layer" for South Africa national team
// fixtures. We fetch the public iCal feed (no auth, server-rendered) and
// expose verified fixture summaries the rest of the app can validate against.
//
// Endpoint: https://www.safa.net/wp-json/afz/v1/fixtures/ical/upcoming/men

export type SafaFixture = {
  uid: string;
  summary: string;
  startUtc: string; // ISO
  location: string;
  url: string;
  opponentSlug: string; // normalized opponent for matching (lower, alnum)
};

function decodeIcs(v: string): string {
  return v
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/gi, "\n")
    .replace(/\\\\/g, "\\")
    .trim();
}

// Parse "20260611T220000" in TZ Africa/Johannesburg (+02:00, no DST) → ISO UTC.
function safaLocalToUtcIso(local: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(local);
  if (!m) return new Date().toISOString();
  const [, Y, M, D, h, mi, s] = m;
  // SAST is +02:00 year-round.
  return new Date(`${Y}-${M}-${D}T${h}:${mi}:${s}+02:00`).toISOString();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function opponentFromSummary(summary: string): string {
  // Formats seen: "Mexico vs Bafana Bafana® - FIFA 2026 World Cup"
  //               "Bafana Bafana vs South Korea - FIFA 2026 World Cup"
  const cleaned = summary.replace(/®/g, "").split(" - ")[0];
  const parts = cleaned.split(/\s+vs\s+/i).map((p) => p.trim());
  if (parts.length !== 2) return "";
  const isBafana = (s: string) => /bafana|south africa/i.test(s);
  const opp = isBafana(parts[0]) ? parts[1] : parts[0];
  return opp.replace(/®/g, "").trim();
}

function parseIcs(text: string): SafaFixture[] {
  // Unfold lines per RFC 5545 (continuation lines start with whitespace).
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const out: SafaFixture[] = [];
  let cur: Partial<SafaFixture> & { startLocal?: string } = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur.uid && cur.summary && cur.startLocal) {
        const opp = opponentFromSummary(cur.summary);
        out.push({
          uid: cur.uid,
          summary: cur.summary,
          startUtc: safaLocalToUtcIso(cur.startLocal),
          location: cur.location ?? "",
          url: cur.url ?? "",
          opponentSlug: normalize(opp),
        });
      }
      continue;
    }
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = rawKey.split(";")[0];
    switch (key) {
      case "UID":
        cur.uid = value.trim();
        break;
      case "SUMMARY":
        cur.summary = decodeIcs(value);
        break;
      case "DTSTART":
        cur.startLocal = value.trim();
        break;
      case "LOCATION":
        cur.location = decodeIcs(value);
        break;
      case "URL":
        cur.url = value.trim();
        break;
    }
  }
  return out;
}

let memCache: { at: number; data: SafaFixture[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

// ============= VERIFIED KICKOFF OVERRIDES =============
//
// SAFA's iCal feed occasionally publishes incorrect kickoff times for matches
// hosted abroad (timezone math drift). When a fixture's SAFA time disagrees
// with FIFA + multiple independent sources (kickoffclock, matchtimes,
// whatisthetime, Al Jazeera, FoxSports, etc.), we override to the canonical
// UTC time below. Each entry MUST cite ≥2 independent sources in the comment.
//
// Key: `${YYYY-MM-DD}|${opponentSlug}` (date in Africa/Johannesburg).
const VERIFIED_KICKOFFS: Record<string, { utc: string; sources: string[] }> = {
  // Mexico vs South Africa, WC 2026 opener, Estadio Azteca.
  // FIFA: 1:00 PM CDT Mexico City = 19:00 UTC = 21:00 SAST.
  // SAFA incorrectly publishes 22:00 SAST (20:00 UTC). Off by +1h.
  "2026-06-11|mexico": {
    utc: "2026-06-11T19:00:00.000Z",
    sources: ["fifa.com", "kickoffclock.com", "matchtimes.app", "whatisthetime.now"],
  },
};

function applyVerifiedKickoffs(fixtures: SafaFixture[]): SafaFixture[] {
  return fixtures.map((f) => {
    const sastDay = new Date(f.startUtc).toLocaleDateString("en-CA", {
      timeZone: "Africa/Johannesburg",
    });
    const utcDay = f.startUtc.slice(0, 10);
    for (const candidateDay of [sastDay, utcDay]) {
      const key = `${candidateDay}|${f.opponentSlug}`;
      const override = VERIFIED_KICKOFFS[key];
      if (override && override.utc !== f.startUtc) {
        console.log(
          `[safa] overriding kickoff for ${f.summary}: ${f.startUtc} → ${override.utc} (verified via ${override.sources.join(", ")})`,
        );
        return { ...f, startUtc: override.utc };
      }
    }
    return f;
  });
}

export async function fetchSafaUpcomingFixtures(): Promise<SafaFixture[]> {
  if (memCache && Date.now() - memCache.at < TTL_MS) return memCache.data;
  try {
    const res = await fetch("https://www.safa.net/wp-json/afz/v1/fixtures/ical/upcoming/men", {
      headers: { "User-Agent": "BafanaSupportersClub/1.0 (+https://safa.net)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[safa] iCal fetch ${res.status}`);
      return memCache?.data ?? [];
    }
    const text = await res.text();
    const data = parseIcs(text);
    console.log(`[safa] parsed ${data.length} upcoming fixtures`);
    memCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("[safa] fetch failed:", err);
    return memCache?.data ?? [];
  }
}

// Returns true if any SAFA fixture plausibly matches the given API-Football
// fixture by opponent + same calendar day. Used as a "truth check".
export function safaConfirms(
  safa: SafaFixture[],
  opponent: string,
  kickoffIso: string,
): boolean {
  if (safa.length === 0) return true; // SAFA unreachable → don't gate
  const oppSlug = normalize(opponent);
  const day = kickoffIso.slice(0, 10);
  return safa.some((f) => {
    const sameDay = f.startUtc.slice(0, 10) === day;
    if (!sameDay) return false;
    // Loose contains-match (handles "Czechi" vs "Czechia", "South Korea" etc.)
    return (
      f.opponentSlug.includes(oppSlug) ||
      oppSlug.includes(f.opponentSlug) ||
      f.opponentSlug.slice(0, 4) === oppSlug.slice(0, 4)
    );
  });
}

export { normalize as normalizeName };

// Look up the og:image for a SAFA match page. Cached in-memory for the
// lifetime of the server instance (URLs are immutable per fixture).
const ogCache = new Map<string, string | null>();

export async function fetchSafaFixtureImage(matchUrl: string): Promise<string | null> {
  if (!matchUrl) return null;
  if (ogCache.has(matchUrl)) return ogCache.get(matchUrl) ?? null;
  try {
    const res = await fetch(matchUrl, {
      headers: { "User-Agent": "BafanaSupportersClub/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      ogCache.set(matchUrl, null);
      return null;
    }
    const html = await res.text();
    const m = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const url = m?.[1] ?? null;
    ogCache.set(matchUrl, url);
    return url;
  } catch (err) {
    console.error(`[safa] og:image fetch failed for ${matchUrl}:`, err);
    ogCache.set(matchUrl, null);
    return null;
  }
}

// Enrich a list of SAFA fixtures with their og:image URLs in parallel,
// bounded concurrency so we don't hammer safa.net.
export async function enrichSafaFixturesWithImages(
  fixtures: SafaFixture[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const BATCH = 4;
  for (let i = 0; i < fixtures.length; i += BATCH) {
    const slice = fixtures.slice(i, i + BATCH);
    const imgs = await Promise.all(slice.map((f) => fetchSafaFixtureImage(f.url)));
    slice.forEach((f, idx) => {
      const img = imgs[idx];
      if (img) out.set(f.uid, img);
    });
  }
  return out;
}

// ============= PLAYER PHOTOS (via Firecrawl) =============
//
// SAFA player pages live at https://www.safa.net/player/{slug}/. The photo is
// embedded in inline CSS as `--match-centre-primary-background-pattern-image:
// url(...)`. We scrape via Firecrawl (rawHtml) which handles WAF/CDN edges
// more reliably than plain fetch, then regex-extract the URL.

export function safaPlayerSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function safaPlayerUrl(name: string): string {
  return `https://www.safa.net/player/${safaPlayerSlug(name)}/`;
}

const playerPhotoCache = new Map<string, string | null>();

function extractPlayerPhoto(html: string): string | null {
  // 1) Player profile headshot (actual face photo on SAFA profile pages).
  const profile = /profile-header-profile-image[\s\S]*?<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (profile?.[1]) return profile[1].trim();
  // 2) Match-centre pattern image fallback.
  const m1 = /--match-centre-primary-background-pattern-image:\s*url\(([^)]+)\)/i.exec(html);
  if (m1?.[1]) return m1[1].replace(/^["']|["']$/g, "").trim();
  // 3) og:image fallback.
  const m2 = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (m2?.[1]) return m2[1];
  return null;
}

export async function fetchSafaPlayerPhoto(name: string): Promise<string | null> {
  const slug = safaPlayerSlug(name);
  if (!slug) return null;
  const cacheKey = `headshot-v2:${slug}`;
  if (playerPhotoCache.has(cacheKey)) return playerPhotoCache.get(cacheKey) ?? null;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[safa] FIRECRAWL_API_KEY not configured; skipping player photo");
    playerPhotoCache.set(cacheKey, null);
    return null;
  }

  const url = `https://www.safa.net/player/${slug}/`;
  try {
    const plain = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; BafanaApp/1.0)" },
    }).then((res) => (res.ok ? res.text() : ""));
    const plainPhoto = plain ? extractPlayerPhoto(plain) : null;
    if (plainPhoto) {
      playerPhotoCache.set(cacheKey, plainPhoto);
      return plainPhoto;
    }

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const firecrawl = new Firecrawl({ apiKey });
    const res = await firecrawl.scrape(url, {
      formats: ["rawHtml"],
      onlyMainContent: false,
    });
    const html =
      (res as { rawHtml?: string }).rawHtml ??
      (res as { data?: { rawHtml?: string } }).data?.rawHtml ??
      "";
    const photo = html ? extractPlayerPhoto(html) : null;
    playerPhotoCache.set(cacheKey, photo);
    return photo;
  } catch (err) {
    console.error(`[safa] firecrawl player photo failed for ${slug}:`, err);
    playerPhotoCache.set(cacheKey, null);
    return null;
  }
}

// Resolve photos for a batch of players with bounded concurrency.
export async function fetchSafaPlayerPhotos(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const BATCH = 3;
  for (let i = 0; i < names.length; i += BATCH) {
    const slice = names.slice(i, i + BATCH);
    const photos = await Promise.all(slice.map((n) => fetchSafaPlayerPhoto(n)));
    slice.forEach((n, idx) => {
      const p = photos[idx];
      if (p) out.set(normalize(n), p);
    });
  }
  return out;
}
