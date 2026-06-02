import { supabase } from "@/integrations/supabase/client";

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

export type Match = {
  id: string;
  opponent: string;
  opponent_flag: string | null;
  kickoff: string;
  venue: string;
  competition: string;
  is_home: boolean;
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
};

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("jersey_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function getPlayer(id: string): Promise<Player | null> {
  const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Player) ?? null;
}

export async function getUpcomingMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .order("kickoff", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getPastMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "completed")
    .order("kickoff", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getNextMatch(): Promise<Match | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .order("kickoff", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Match) ?? null;
}

export async function getMatch(id: string): Promise<Match | null> {
  const { data, error } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Match) ?? null;
}

export async function getNews(category?: Article["category"]): Promise<Article[]> {
  let q = supabase.from("news_articles").select("*").order("published_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function getArticle(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Article) ?? null;
}

export async function getFeaturedPlayer(): Promise<Player | null> {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("name", "Percy Tau")
    .maybeSingle();
  return (data as Player) ?? null;
}
