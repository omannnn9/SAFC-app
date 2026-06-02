// Country name → ISO-2 → regional-indicator emoji flag.
// Covers Bafana's realistic opponent pool (CAF + common friendlies).
const COUNTRY_ISO: Record<string, string> = {
  "south africa": "ZA", "bafana bafana": "ZA", rsa: "ZA",
  mexico: "MX", brazil: "BR", argentina: "AR", france: "FR", germany: "DE",
  spain: "ES", portugal: "PT", england: "GB", italy: "IT", netherlands: "NL",
  belgium: "BE", croatia: "HR", "united states": "US", usa: "US",
  morocco: "MA", egypt: "EG", tunisia: "TN", algeria: "DZ", senegal: "SN",
  nigeria: "NG", ghana: "GH", "ivory coast": "CI", "côte d'ivoire": "CI",
  cameroon: "CM", mali: "ML", "burkina faso": "BF", zambia: "ZM",
  zimbabwe: "ZW", botswana: "BW", namibia: "NA", lesotho: "LS",
  eswatini: "SZ", swaziland: "SZ", mozambique: "MZ", angola: "AO",
  "dr congo": "CD", "democratic republic of congo": "CD", congo: "CG",
  kenya: "KE", uganda: "UG", tanzania: "TZ", ethiopia: "ET", rwanda: "RW",
  sudan: "SD", "south sudan": "SS", libya: "LY", "cape verde": "CV",
  "cabo verde": "CV", gabon: "GA", guinea: "GN", "guinea-bissau": "GW",
  benin: "BJ", togo: "TG", "sierra leone": "SL", liberia: "LR",
  madagascar: "MG", mauritius: "MU", comoros: "KM", seychelles: "SC",
  czechia: "CZ", "czech republic": "CZ", japan: "JP", "south korea": "KR",
  korea: "KR", australia: "AU", "new zealand": "NZ", canada: "CA",
  uruguay: "UY", chile: "CL", colombia: "CO", peru: "PE", ecuador: "EC",
  paraguay: "PY", venezuela: "VE", "saudi arabia": "SA", qatar: "QA",
  uae: "AE", iran: "IR", iraq: "IQ", turkey: "TR", ireland: "IE",
  scotland: "GB", wales: "GB", "northern ireland": "GB",
};

export function nameToFlag(name: string | null | undefined): string {
  if (!name) return "🏳️";
  const iso = COUNTRY_ISO[name.trim().toLowerCase()];
  if (!iso) return "🏳️";
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
