import { supabase } from "@/integrations/supabase/client";
import { getLiveNews } from "./live.functions";
import { getSafaSquad, getSafaPlayer, getSafaMatches } from "./safa.functions";

export type Player = {
  id: string; // SAFA slug
  slug: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  position_label: string;
  club: string | null;
  photo_url: string | null;
  flag_url: string | null;
  flag_code: string | null;
  // Optional rich details (only present on detail page)
  nickname?: string | null;
  born?: string | null;
  height?: string | null;
  province?: string | null;
  background?: string | null;
  quote?: string | null;
};

export type Manager = {
  id: string;
  name: string;
  role: "Manager";
  nationality: string | null;
  photo_url: string | null;
};

export type MatchTeam = {
  name: string;
  logo: string | null;
  is_bafana: boolean;
};

export type Match = {
  id: string;
  opponent: string;
  cover_url?: string | null;
  kickoff: string;
  venue: string;
  competition: string;
  competition_logo: string | null;
  is_home: boolean;
  home_team: MatchTeam;
  away_team: MatchTeam;
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "live" | "completed";
  url?: string;
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  category: "team" | "match" | "player" | "supporter";
  is_premium: boolean;
  published_at: string;
  source?: string;
  url?: string;
  score?: number;
  relevance?: "high" | "medium" | "low";
  matched_entities?: string[];
};

// ============= PLAYERS =============

export async function getPlayers(): Promise<Player[]> {
  try {
    const res = await getSafaSquad();
    const list = res?.data ?? [];
    return list.map((p) => ({
      id: p.slug,
      slug: p.slug,
      name: p.name,
      position: p.position,
      position_label: p.position_label,
      club: null,
      photo_url: p.photo_url,
      flag_url: p.flag_url,
      flag_code: p.flag_code,
    }));
  } catch (err) {
    console.error("[data] getPlayers failed:", err);
    return [];
  }
}

export async function getPlayer(slug: string): Promise<Player | null> {
  try {
    const [listRes, detailRes] = await Promise.all([
      getSafaSquad(),
      getSafaPlayer({ data: slug }),
    ]);
    const listItem = (listRes?.data ?? []).find((p) => p.slug === slug);
    const d = detailRes?.data;
    if (!listItem && !d) return null;
    return {
      id: slug,
      slug,
      name: d?.name ?? listItem?.name ?? slug.replace(/-/g, " "),
      position: listItem?.position ?? d?.position ?? "FWD",
      position_label: listItem?.position_label ?? d?.position_label ?? "",
      club: d?.club ?? null,
      photo_url: listItem?.photo_url ?? d?.photo_url ?? null,
      flag_url: listItem?.flag_url ?? null,
      flag_code: listItem?.flag_code ?? "ZA",
      nickname: d?.nickname ?? null,
      born: d?.born ?? null,
      height: d?.height ?? null,
      province: d?.province ?? null,
      background: d?.background ?? null,
      quote: d?.quote ?? null,
    };
  } catch (err) {
    console.error(`[data] getPlayer(${slug}) failed:`, err);
    return null;
  }
}

export async function getFeaturedPlayer(): Promise<Player | null> {
  const list = await getPlayers();
  return list.find((p) => p.position === "FWD") ?? list[0] ?? null;
}

export async function getManager(): Promise<Manager> {
  return {
    id: "manager-broos",
    name: "Hugo Broos",
    role: "Manager",
    nationality: "Belgium",
    photo_url: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Hugo_Broos_1.jpg",
  };
}

// ============= MATCHES =============

async function getAllMatches(): Promise<Match[]> {
  try {
    const res = await getSafaMatches();
    const list = res?.data ?? [];
    return list.map((m) => ({
      id: m.id,
      opponent: m.opponent,
      cover_url: m.home_logo && m.away_logo ? (m.is_home ? m.away_logo : m.home_logo) : null,
      kickoff: m.kickoff_iso,
      venue: m.venue || "TBD",
      competition: m.competition ?? "International",
      competition_logo: m.competition_logo,
      is_home: m.is_home,
      home_team: {
        name: m.home_name,
        logo: m.home_logo,
        is_bafana: /bafana|south africa/i.test(m.home_name),
      },
      away_team: {
        name: m.away_name,
        logo: m.away_logo,
        is_bafana: /bafana|south africa/i.test(m.away_name),
      },
      home_score: m.home_score,
      away_score: m.away_score,
      status: m.status,
      url: m.url,
    }));
  } catch (err) {
    console.error("[data] getAllMatches failed:", err);
    return [];
  }
}

export async function getUpcomingMatches(): Promise<Match[]> {
  const all = await getAllMatches();
  return all
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}

export async function getPastMatches(): Promise<Match[]> {
  const all = await getAllMatches();
  return all
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
}

export async function getNextMatch(): Promise<Match | null> {
  const list = await getUpcomingMatches();
  return list[0] ?? null;
}

export async function getMatch(id: string): Promise<Match | null> {
  const all = await getAllMatches();
  return all.find((m) => m.id === id) ?? null;
}

// ============= NEWS =============

export async function getNews(category?: Article["category"]): Promise<Article[]> {
  let live: Article[] = [];
  try {
    const res = await getLiveNews();
    if (res?.data) live = res.data as Article[];
  } catch {
    /* fall through */
  }
  if (live.length === 0) {
    let q = supabase.from("news_articles").select("*").order("published_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data } = await q;
    return (data ?? []) as Article[];
  }
  return category ? live.filter((a) => a.category === category) : live;
}

export async function getArticle(slug: string): Promise<Article | null> {
  // 1. Try live aggregated news (most articles live here — slugs include source suffix)
  try {
    const list = await getNews();
    const hit = list.find((a) => a.slug === slug);
    if (hit) return hit;
  } catch (err) {
    console.warn("[data] getArticle live lookup failed:", err);
  }
  // 2. Fallback to Supabase (legacy / editorial content)
  const { data } = await supabase
    .from("news_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Article) ?? null;
}
