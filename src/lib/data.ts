import { supabase } from "@/integrations/supabase/client";
import {
  getLiveUpcomingMatches,
  getLivePastMatches,
  getLivePlayers,
  getLiveNews,
} from "./live.functions";

export type Player = {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  club: string;
  jersey_number: number | null;
  caps: number;
  goals: number;
  assists: number;
  photo_url: string | null;
  bio: string | null;
};

export type MatchTeam = {
  id: number | null;
  name: string;
  logo: string | null;
  country_code?: string | null;
};

export type Match = {
  id: string;
  opponent: string;
  opponent_flag: string | null;
  /** Large match visual. Prefers SAFA Match Centre og:image, falls back to API-Football team logo. */
  cover_url?: string | null;
  kickoff: string;
  venue: string;
  competition: string;
  is_home: boolean;
  home_team?: MatchTeam;
  away_team?: MatchTeam;
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "live" | "completed";
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
};

// ============= PLAYERS =============

export async function getPlayers(): Promise<Player[]> {
  try {
    const res = await getLivePlayers();
    if (res?.data && res.data.length > 0) return res.data as Player[];
  } catch {
    /* fall through */
  }
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("jersey_number", { ascending: true });
  return (data ?? []) as Player[];
}

export async function getPlayer(id: string): Promise<Player | null> {
  if (id.startsWith("af-")) {
    const list = await getPlayers();
    return list.find((p) => p.id === id) ?? null;
  }
  const { data } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  return (data as Player) ?? null;
}

export async function getFeaturedPlayer(): Promise<Player | null> {
  const list = await getPlayers();
  return list.find((p) => p.position === "FWD") ?? list[0] ?? null;
}

// ============= MATCHES =============

export async function getUpcomingMatches(): Promise<Match[]> {
  try {
    const res = await getLiveUpcomingMatches();
    if (res?.data && res.data.length > 0) return res.data as Match[];
  } catch {
    /* fall through */
  }
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .order("kickoff", { ascending: true });
  return (data ?? []) as Match[];
}

export async function getPastMatches(): Promise<Match[]> {
  try {
    const res = await getLivePastMatches();
    if (res?.data && res.data.length > 0) return res.data as Match[];
  } catch {
    /* fall through */
  }
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "completed")
    .order("kickoff", { ascending: false });
  return (data ?? []) as Match[];
}

export async function getNextMatch(): Promise<Match | null> {
  const list = await getUpcomingMatches();
  return list[0] ?? null;
}

export async function getMatch(id: string): Promise<Match | null> {
  if (id.startsWith("af-")) {
    const [up, past] = await Promise.all([getUpcomingMatches(), getPastMatches()]);
    return [...up, ...past].find((m) => m.id === id) ?? null;
  }
  const { data } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  return (data as Match) ?? null;
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
  if (slug.startsWith("news-") || /-\d+$/.test(slug)) {
    const list = await getNews();
    return list.find((a) => a.slug === slug) ?? null;
  }
  const { data } = await supabase
    .from("news_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Article) ?? null;
}
