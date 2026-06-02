export const SOUTH_AFRICA_TEAM_ID = 1531;

type CountryValidation = {
  code: string | null;
  flag: string;
  name: string | null;
  valid: boolean;
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
// Build alpha-2 set from Intl supported region codes
const alpha2Codes: Record<string, string> = {};
for (let i = 0; i < 26; i++) {
  for (let j = 0; j < 26; j++) {
    const code = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
    try {
      const name = regionNames.of(code);
      if (name && name !== code) alpha2Codes[code] = name;
    } catch {}
  }
}

function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/®/g, "")
    .replace(/\b(national|team|men|women)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const nameToCode = new Map<string, string>();
for (const code of Object.keys(alpha2Codes)) {
  const displayName = regionNames.of(code);
  if (displayName) nameToCode.set(normalizeCountryName(displayName), code);
}

const ALIASES: Record<string, { code: string; name?: string; flag?: string }> = {
  "bafana bafana": { code: "ZA", name: "South Africa" },
  rsa: { code: "ZA", name: "South Africa" },
  "south african": { code: "ZA", name: "South Africa" },
  czechi: { code: "CZ", name: "Czechia" },
  "czech republic": { code: "CZ", name: "Czechia" },
  "korea republic": { code: "KR", name: "South Korea" },
  korea: { code: "KR", name: "South Korea" },
  usa: { code: "US", name: "United States" },
  "u s a": { code: "US", name: "United States" },
  uae: { code: "AE", name: "United Arab Emirates" },
  "ivory coast": { code: "CI", name: "Côte d’Ivoire" },
  "cape verde": { code: "CV", name: "Cabo Verde" },
  "dr congo": { code: "CD", name: "DR Congo" },
  "d r congo": { code: "CD", name: "DR Congo" },
  "democratic republic of congo": { code: "CD", name: "DR Congo" },
  england: { code: "GB", name: "England", flag: "🏴" },
  scotland: { code: "GB", name: "Scotland", flag: "🏴" },
  wales: { code: "GB", name: "Wales", flag: "🏴" },
  "northern ireland": { code: "GB", name: "Northern Ireland", flag: "🇬🇧" },
};

function isValidAlpha2(code: string | null | undefined): code is string {
  return !!code && /^[A-Z]{2}$/.test(code.toUpperCase()) && code.toUpperCase() in alpha2Codes;
}

export function countryCodeToFlag(code: string | null | undefined): string {
  if (!isValidAlpha2(code)) return "🏳️";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function validateCountryFlag(
  name: string | null | undefined,
  countryCode?: string | null,
): CountryValidation {
  const normalized = normalizeCountryName(name ?? "");
  const alias = normalized ? ALIASES[normalized] : undefined;
  const explicitCode = isValidAlpha2(countryCode) ? countryCode.toUpperCase() : null;
  const code = explicitCode ?? alias?.code ?? (normalized ? nameToCode.get(normalized) ?? null : null);
  const displayName = alias?.name ?? (code ? regionNames.of(code) ?? name ?? null : null);
  const flag = alias?.flag ?? countryCodeToFlag(code);

  return {
    code,
    flag,
    name: displayName,
    valid: Boolean(code && flag !== "🏳️"),
  };
}

export function nameToFlag(name: string | null | undefined): string {
  return validateCountryFlag(name).flag;
}

export function nameToCountryCode(name: string | null | undefined): string | null {
  return validateCountryFlag(name).code;
}

export function canonicalCountryName(name: string | null | undefined): string | null {
  return validateCountryFlag(name).name;
}

export function validateFixtureFlagData(
  fixtureId: string,
  home: { id?: number | null; name?: string | null; country_code?: string | null },
  away: { id?: number | null; name?: string | null; country_code?: string | null },
  source = "fixtures",
) {
  const h = validateCountryFlag(home.name, home.country_code);
  const a = validateCountryFlag(away.name, away.country_code);
  const issues: string[] = [];

  if (!h.valid) issues.push(`invalid home flag for "${home.name ?? "unknown"}"`);
  if (!a.valid) issues.push(`invalid away flag for "${away.name ?? "unknown"}"`);
  if (h.code && a.code && h.code === a.code && home.id !== away.id) issues.push(`duplicate country code ${h.code}`);
  if (home.id === SOUTH_AFRICA_TEAM_ID && away.id === SOUTH_AFRICA_TEAM_ID) issues.push("South Africa duplicated on both sides");

  if (issues.length > 0) {
    console.warn(`[flag-validate:${source}] ${fixtureId} — ${issues.join("; ")}`, {
      home: { ...home, resolved: h },
      away: { ...away, resolved: a },
    });
  }

  return { home: h, away: a, issues };
}
