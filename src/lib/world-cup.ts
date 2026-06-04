export type WorldCupStatus = "upcoming" | "live" | "finished";

export type WorldCupMatch = {
  id: string;
  match_number: number;
  stage: string;
  group_name: string | null;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  venue: string | null;
  city: string | null;
  kickoff_datetime_utc: string;
  kickoff?: string;
  status: WorldCupStatus;
  status_override: WorldCupStatus | null;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  created_at?: string;
  updated_at?: string;
};

export type WorldCupFlag = {
  country_name: string;
  flag: string;
  is_placeholder: boolean;
};

export const WORLD_CUP_TOTAL_MATCHES = 104;
export const MATCH_DURATION_MS = 120 * 60 * 1000;

export const WORLD_CUP_STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"] as const;

export const WORLD_CUP_STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-final",
  sf: "Semi-final",
  third: "Third Place",
  final: "Final",
};

export function getKickoff(match: Pick<WorldCupMatch, "kickoff_datetime_utc" | "kickoff">) {
  return match.kickoff_datetime_utc || match.kickoff || new Date(0).toISOString();
}

export function statusOf(match: Pick<WorldCupMatch, "kickoff_datetime_utc" | "kickoff" | "status_override">, now: number): WorldCupStatus {
  if (match.status_override) return match.status_override;
  const kickoff = new Date(getKickoff(match)).getTime();
  if (!Number.isFinite(kickoff)) return "upcoming";
  if (now < kickoff) return "upcoming";
  if (now <= kickoff + MATCH_DURATION_MS) return "live";
  return "finished";
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "Kickoff";
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function liveMinute(match: Pick<WorldCupMatch, "kickoff_datetime_utc" | "kickoff">, now: number) {
  const kickoff = new Date(getKickoff(match)).getTime();
  const minutes = Math.floor((now - kickoff) / 60000);
  return Math.max(1, Math.min(minutes, 120));
}

export function stageLabel(match: Pick<WorldCupMatch, "stage" | "group_name">) {
  if (match.stage === "group") return match.group_name ? `Group ${match.group_name}` : "Group Stage";
  return WORLD_CUP_STAGE_LABELS[match.stage] ?? match.stage;
}

export function flagMap(flags: WorldCupFlag[]) {
  return new Map(flags.map((flag) => [flag.country_name, flag.flag]));
}

export function isPlaceholderTeam(name: string) {
  return /^(Group [A-L] Team [1-4]|Winner Group [A-L]|Runner-up Group [A-L]|Third Place Group [A-L]|Winner Match \d+|Loser Match \d+|Finalist \d+|TBD)$/i.test(
    name.trim(),
  );
}

export function displayTeamName(name: string) {
  const groupSlot = name.match(/^Group ([A-L]) Team ([1-4])$/i);
  if (groupSlot) return { primary: "TBD", secondary: `Group ${groupSlot[1].toUpperCase()} slot ${groupSlot[2]}` };
  if (isPlaceholderTeam(name)) return { primary: "TBD", secondary: name };
  return { primary: name, secondary: null };
}

export function validateWorldCup(matches: WorldCupMatch[], flags: WorldCupFlag[]) {
  const warnings: string[] = [];
  const byNumber = new Map<number, WorldCupMatch[]>();
  matches.forEach((match) => {
    const list = byNumber.get(match.match_number) ?? [];
    list.push(match);
    byNumber.set(match.match_number, list);
  });

  const missing = Array.from({ length: WORLD_CUP_TOTAL_MATCHES }, (_, index) => index + 1).filter(
    (number) => !byNumber.has(number),
  );
  if (missing.length) warnings.push(`Missing match slots: ${missing.join(", ")}`);

  const duplicates = [...byNumber.entries()].filter(([, list]) => list.length > 1).map(([number]) => number);
  if (duplicates.length) warnings.push(`Duplicate match numbers: ${duplicates.join(", ")}`);

  const expectedStages: Record<string, number> = { group: 72, r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 };
  Object.entries(expectedStages).forEach(([stage, count]) => {
    const actual = matches.filter((match) => match.stage === stage).length;
    if (actual !== count) warnings.push(`${WORLD_CUP_STAGE_LABELS[stage] ?? stage} count should be ${count}, found ${actual}.`);
  });

  const flagsByCountry = flagMap(flags);
  matches.forEach((match) => {
    if (!match.venue?.trim()) warnings.push(`Match ${match.match_number} has an empty venue.`);
    if (!Number.isFinite(new Date(getKickoff(match)).getTime())) warnings.push(`Match ${match.match_number} has an invalid kickoff date.`);
    const homeExpected = flagsByCountry.get(match.home_team);
    const awayExpected = flagsByCountry.get(match.away_team);
    if (!homeExpected && !isPlaceholderTeam(match.home_team)) warnings.push(`Match ${match.match_number} home team has no verified flag mapping: ${match.home_team}.`);
    if (homeExpected && match.home_flag !== homeExpected) warnings.push(`Match ${match.match_number} has invalid home flag for ${match.home_team}.`);
    if (!awayExpected && !isPlaceholderTeam(match.away_team)) warnings.push(`Match ${match.match_number} away team has no verified flag mapping: ${match.away_team}.`);
    if (awayExpected && match.away_flag !== awayExpected) warnings.push(`Match ${match.match_number} has invalid away flag for ${match.away_team}.`);
  });

  return warnings;
}