import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VapidKeys = {
  publicKey: string; // base64url uncompressed P-256
  privateKey: string; // base64url 32-byte d
};

const CONTACT = "mailto:notifications@bafana.app";

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function bytesFromB64url(b64: string): Uint8Array {
  const pad = b64.length % 4 === 2 ? "==" : b64.length % 4 === 3 ? "=" : "";
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

let cached: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "vapid")
    .maybeSingle();
  if (data?.value) {
    cached = data.value as VapidKeys;
    return cached;
  }
  // Generate new keypair
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  // Build uncompressed public key (0x04 || X || Y)
  const x = bytesFromB64url(pubJwk.x!);
  const y = bytesFromB64url(pubJwk.y!);
  const pub = new Uint8Array(65);
  pub[0] = 0x04;
  pub.set(x, 1);
  pub.set(y, 33);
  const d = bytesFromB64url(privJwk.d!);
  cached = {
    publicKey: b64urlFromBytes(pub),
    privateKey: b64urlFromBytes(d),
  };
  await supabaseAdmin
    .from("app_config")
    .upsert({ key: "vapid", value: cached as never, updated_at: new Date().toISOString() });
  return cached;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

export function getVapidContact() {
  return CONTACT;
}
