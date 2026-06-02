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
