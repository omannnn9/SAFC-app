export const WATCH_PARTY_SOURCES = {
  welcomect: {
    label: "Cape Town",
    venue: "Toad on the Road",
    venue_tag: "@toadontheroad",
    slug: "welcomect",
  },
  welcomejozi: {
    label: "Jozi",
    venue: "Native Rebels",
    venue_tag: "@NativeRebels",
    slug: "welcomejozi",
  },
  welcomeuk: {
    label: "UK",
    venue: "our UK watch party venue",
    venue_tag: "@SouthAfricaFC",
    slug: "welcomeuk",
  },
  main: {
    label: "Main site",
    venue: "southafricafc.com",
    venue_tag: "@SouthAfricaFC",
    slug: "main",
  },
} as const;

export type WatchPartySourceKey = keyof typeof WATCH_PARTY_SOURCES;

export function safeSourceKey(raw: unknown): WatchPartySourceKey {
  const key = String(raw || "main")
    .trim()
    .toLowerCase()
    .replaceAll("/", "");
  return key in WATCH_PARTY_SOURCES ? (key as WatchPartySourceKey) : "main";
}

export function watchPartyConfig(rawSource: unknown) {
  const key = safeSourceKey(rawSource);
  const source = WATCH_PARTY_SOURCES[key];
  return {
    source_key: key,
    location: source.label,
    venue: source.venue,
    venue_tag: source.venue_tag,
    safc_handle: "@southafricafc",
    social: {
      instagram: "https://www.instagram.com/southafricafc/",
      instagram_handle: "@southafricafc",
      x: process.env.SAFC_X_URL || "https://x.com/SouthAfricaFC10",
      x_handle: process.env.SAFC_X_HANDLE || "@SouthAfricaFC10",
      facebook: process.env.SAFC_FACEBOOK_URL || "https://www.facebook.com/southafricafc/",
      facebook_handle: process.env.SAFC_FACEBOOK_HANDLE || "South Africa Football Community",
      tiktok: "https://www.tiktok.com/@southafrica.fc10",
      tiktok_handle: "@southafrica.fc10",
      youtube: "https://www.youtube.com/@SouthAfricaFC10",
      youtube_handle: "@SouthAfricaFC10",
    },
    google_client_id: process.env.SAFC_GOOGLE_CLIENT_ID || "",
  };
}

export function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function makeSupporterCode(sourceKey: WatchPartySourceKey) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SAFC-${sourceKey.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function makePaymentReference(sourceKey: WatchPartySourceKey) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SAFC-FM-${sourceKey.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export type WatchPartySignupMetadata = {
  source_key?: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  province?: string;
  supporter_code?: string;
  payment_reference?: string;
  created_at?: string;
  source_location?: string;
  watch_party_venue?: string;
  [key: string]: unknown;
};

export function requireWatchPartyAdmin(request: Request) {
  const token = process.env.SAFC_WATCHPARTY_ADMIN_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  return bearer === token || request.headers.get("x-watchparty-admin-token") === token;
}
