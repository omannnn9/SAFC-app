import { verifyKickoff } from "@/lib/safa.server";

// Comprehensive SAFA Match Centre scraper. SAFA is used for squad/profile
// content and fixture metadata, but NOT as the authority for kickoff times.
// Kickoffs are always passed through the verified multi-source override layer.
//
// Source pages:
//   https://www.safa.net/match-centre/teams/south-africa/players
//   https://www.safa.net/match-centre/teams/south-africa/fixtures
//   https://www.safa.net/player/{slug}/
//   https://www.safa.net/match-centre/fixtures/{slug}/

const UA = "Mozilla/5.0 (compatible; BafanaSupportersClub/1.0; +https://safa.net)";

async function getHtml(url: string, timeoutMs = 10000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`SAFA ${res.status} for ${url}`);
  return await res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export type SafaSquadPlayer = {
  slug: string;
  name: string;
  position_label: string; // "Defender" | "Forward" | ...
  position: "GK" | "DEF" | "MID" | "FWD";
  photo_url: string | null;
  flag_url: string | null;
  flag_code: string | null;
};

export type SafaPlayerDetails = SafaSquadPlayer & {
  nickname: string | null;
  club: string | null;
  born: string | null;
  height: string | null;
  province: string | null;
  background: string | null;
  quote: string | null;
};

export type SafaMatch = {
  id: string;
  url: string;
  competition_logo: string | null;
  competition: string | null;
  kickoff_iso: string; // ISO UTC
  venue: string;
  home_name: string;
  home_logo: string | null;
  away_name: string;
  away_logo: string | null;
  status: "upcoming" | "completed";
  home_score: number | null;
  away_score: number | null;
  is_home: boolean; // Bafana home?
  opponent: string;
};

export function mapPositionLabel(label: string): SafaSquadPlayer["position"] {
  const s = label.toLowerCase();
  if (s.startsWith("goal")) return "GK";
  if (s.startsWith("def")) return "DEF";
  if (s.startsWith("mid")) return "MID";
  return "FWD";
}

// ============= SQUAD LIST =============

export async function fetchSafaSquadList(): Promise<SafaSquadPlayer[]> {
  const html = await getHtml("https://www.safa.net/match-centre/teams/south-africa/players");
  const out: SafaSquadPlayer[] = [];
  const cardRe = /<a class="player-card "[^>]*href="https:\/\/www\.safa\.net\/player\/([^"]+)\/"[\s\S]*?<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const block = m[0];
    const slug = m[1];
    const imgMatch = /<img[^>]+src="([^"]+)"[^>]*class="featured-image[^"]*"/.exec(block);
    const nameMatch = /<span class="name">\s*([\s\S]*?)<\/span>/.exec(block);
    const posMatch = /<span class="position">([\s\S]*?)<\/span>/.exec(block);
    const flagMatch = /<img[^>]+class="details-images-flag"[^>]+src="([^"]+)"/.exec(block) ||
      /<img[^>]+src="([^"]+)"[^>]+class="details-images-flag"/.exec(block);
    const name = nameMatch ? clean(nameMatch[1]) : "";
    const posLabel = posMatch ? clean(posMatch[1]) : "";
    const flagUrl = flagMatch ? flagMatch[1] : null;
    const flagCodeMatch = flagUrl ? /\/([a-z]{2})\.(?:png|svg|webp)/i.exec(flagUrl) : null;
    out.push({
      slug,
      name,
      position_label: posLabel,
      position: mapPositionLabel(posLabel),
      photo_url: imgMatch ? imgMatch[1] : null,
      flag_url: flagUrl,
      flag_code: flagCodeMatch ? flagCodeMatch[1].toUpperCase() : null,
    });
  }
  console.log(`[safa-scrape] squad: ${out.length} players`);
  return out;
}

// ============= PLAYER DETAIL =============

function pickField(html: string, label: string): string | null {
  // Matches: <p><b>Label</b><span ...>: value</span></p>
  //      or: <p><b>Label</b>: value</p>
  const re = new RegExp(
    `<p>\\s*<b>${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}<\\/b>([\\s\\S]*?)<\\/p>`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;
  let v = clean(m[1]);
  v = v.replace(/^:\s*/, "").trim();
  // some values like "24 January 1997)" have stray ")" — keep but trim trailing
  return v || null;
}

export async function fetchSafaPlayerDetails(slug: string): Promise<SafaPlayerDetails | null> {
  const html = await getHtml(`https://www.safa.net/player/${slug}/`);
  const titleMatch = /<title>([^<,]+)/.exec(html);
  const name = titleMatch ? clean(titleMatch[1]) : slug.replace(/-/g, " ");
  const photoMatch = /profile-header-profile-image[\s\S]*?<img[^>]+src="([^"]+)"/.exec(html);
  const descMatch = /class="description">([\s\S]*?)<\/div>/.exec(html);
  const desc = descMatch ? descMatch[1] : "";
  const positionLabel = pickField(html, "Position") ?? "";
  return {
    slug,
    name,
    position_label: positionLabel,
    position: mapPositionLabel(positionLabel || "FWD"),
    photo_url: photoMatch ? photoMatch[1] : null,
    flag_url: null,
    flag_code: "ZA",
    nickname: pickField(desc, "Nickname"),
    club: pickField(desc, "Club"),
    born: pickField(desc, "Born")?.replace(/\)\s*$/, "") ?? null,
    height: pickField(desc, "Height"),
    province: pickField(desc, "Province/School") ?? pickField(desc, "Province"),
    background: pickField(desc, "Background/Insights") ?? pickField(desc, "Background"),
    quote: pickField(desc, "Quote"),
  };
}

// ============= FIXTURES & RESULTS =============

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Parse SAFA's displayed "Thursday, 11 June 2026" + "22:00" SAST → ISO UTC.
// This raw value is never exposed directly; parseMatchBlock verifies/overrides it.
function parseKickoff(dayLine: string, dateLine: string, timeText: string): string {
  const dm = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(dateLine);
  if (!dm) return new Date().toISOString();
  const day = Number(dm[1]);
  const month = MONTHS[dm[2].toLowerCase()] ?? 0;
  const year = Number(dm[3]);
  const tm = /(\d{1,2}):(\d{2})/.exec(timeText);
  const hh = tm ? Number(tm[1]) : 18;
  const mm = tm ? Number(tm[2]) : 0;
  // SAST is +02:00 year-round
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+02:00`;
  return new Date(iso).toISOString();
}

function isBafana(name: string): boolean {
  return /bafana|south africa/i.test(name);
}

function parseMatchBlock(block: string): SafaMatch | null {
  const urlMatch = /href="(https:\/\/www\.safa\.net\/match-centre\/fixtures\/[^"]+)"/.exec(block);
  if (!urlMatch) return null;
  const url = urlMatch[1];
  const id = `safa-${url.replace(/^.*\/fixtures\//, "").replace(/\/$/, "")}`;

  const tournamentLogo = /match-centre-fixture-tournament[\s\S]*?<img[^>]+src="([^"]+)"/.exec(block);
  const dateBlock = /match-centre-fixture-date">([\s\S]*?)<\/a>/.exec(block);
  let dayLine = "";
  let dateLine = "";
  let venue = "";
  if (dateBlock) {
    const lines = Array.from(dateBlock[1].matchAll(/<div(?:\s[^>]*)?>([\s\S]*?)<\/div>/g)).map((m) => clean(m[1]));
    dayLine = lines[0] ?? "";
    dateLine = lines[1] ?? "";
    venue = lines.find((l) => l && l !== dayLine && l !== dateLine && !/^\d/.test(l)) ?? "";
  }
  // Team names (two consecutive .match-centre-fixture-team-name)
  const teamNames = Array.from(
    block.matchAll(/match-centre-fixture-team-name">\s*([\s\S]*?)<\/div>/g),
  ).map((m) => clean(m[1]).replace(/®/g, ""));
  if (teamNames.length < 2) return null;
  const [homeName, awayName] = teamNames;

  // Team logos inside trailing
  const trailing = /match-centre-fixture-trailing[\s\S]*$/.exec(block);
  const logos = trailing
    ? Array.from(trailing[0].matchAll(/match-centre-fixture-team-logo[\s\S]*?<img[^>]+src="([^"]+)"/g)).map((m) => m[1])
    : [];

  // Score block: either "HH:MM" (upcoming) or "<span>X</span>-<span>Y</span>" (completed)
  const scoreBlock = /match-centre-fixture-score[^>]*>([\s\S]*?)<\/div>/.exec(block);
  let status: SafaMatch["status"] = "upcoming";
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  let timeText = "18:00";
  if (scoreBlock) {
    const inner = scoreBlock[1];
    const spanScores = Array.from(inner.matchAll(/<span(?:\s[^>]*)?>(\d+)<\/span>/g)).map((m) => Number(m[1]));
    if (spanScores.length >= 2) {
      status = "completed";
      homeScore = spanScores[0];
      awayScore = spanScores[1];
    } else {
      const txt = clean(inner);
      const tm = /\d{1,2}:\d{2}/.exec(txt);
      if (tm) timeText = tm[0];
    }
  }
  const bafanaHome = isBafana(homeName);
  const opponent = bafanaHome ? awayName : homeName;
  const rawKickoffIso = parseKickoff(dayLine, dateLine, timeText);
  const kickoffIso = verifyKickoff(opponent, rawKickoffIso);

  return {
    id,
    url,
    competition_logo: tournamentLogo ? tournamentLogo[1] : null,
    competition: null,
    kickoff_iso: kickoffIso,
    venue,
    home_name: homeName,
    home_logo: logos[0] ?? null,
    away_name: awayName,
    away_logo: logos[1] ?? null,
    status,
    home_score: homeScore,
    away_score: awayScore,
    is_home: bafanaHome,
    opponent,
  };
}

export async function fetchSafaAllMatches(): Promise<SafaMatch[]> {
  const html = await getHtml("https://www.safa.net/match-centre/teams/south-africa/fixtures");
  const out: SafaMatch[] = [];
  const blockRe = /<div class="match-centre-fixture">([\s\S]*?)<\/div>\s*<\/div>/g;
  // Simpler: split on the opener
  const parts = html.split('<div class="match-centre-fixture">').slice(1);
  for (const raw of parts) {
    // bound the block until next opener (already split) — take up to a sentinel
    const m = parseMatchBlock(raw);
    if (m) out.push(m);
  }
  void blockRe;
  // De-dupe by id
  const seen = new Set<string>();
  const dedup = out.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  console.log(`[safa-scrape] matches: ${dedup.length} (parsed ${out.length})`);
  return dedup;
}
