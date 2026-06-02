// Web Push (RFC 8030 + RFC 8291 aes128gcm) using only WebCrypto + jose.
// Cloudflare Workers compatible — no Node-only deps.
import { SignJWT, importJWK } from "jose";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getVapidKeys, getVapidContact } from "./vapid.server";

function b64urlFromBytes(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function bytesFromB64url(b64: string): Uint8Array {
  const pad = b64.length % 4 === 2 ? "==" : b64.length % 4 === 3 ? "=" : "";
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function uncompressedPubToJwk(uncompressed: Uint8Array) {
  // 0x04 || X(32) || Y(32)
  return {
    kty: "EC",
    crv: "P-256",
    x: b64urlFromBytes(uncompressed.slice(1, 33)),
    y: b64urlFromBytes(uncompressed.slice(33, 65)),
    ext: true,
  };
}

async function buildVapidAuthHeader(audience: string): Promise<string> {
  const { publicKey, privateKey } = await getVapidKeys();
  const pub = bytesFromB64url(publicKey);
  const pubJwk = uncompressedPubToJwk(pub);
  const privJwk = { ...pubJwk, d: b64urlFromBytes(bytesFromB64url(privateKey)) };
  const key = await importJWK(privJwk as never, "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(audience)
    .setExpirationTime(Math.floor(Date.now() / 1000) + 12 * 60 * 60)
    .setSubject(getVapidContact())
    .sign(key);
  return `vapid t=${jwt}, k=${publicKey}`;
}

export type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function encryptPayload(
  payload: Uint8Array,
  clientPub: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array }> {
  // Generate ephemeral ECDH P-256 keypair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const ephemPubJwk = await crypto.subtle.exportKey("jwk", ephemeral.publicKey);
  const ephemPub = concat(
    new Uint8Array([0x04]),
    bytesFromB64url(ephemPubJwk.x!),
    bytesFromB64url(ephemPubJwk.y!),
  );

  // Import client's public key as ECDH
  const clientJwk = uncompressedPubToJwk(clientPub);
  const clientKey = await crypto.subtle.importKey(
    "jwk",
    clientJwk as never,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    ephemeral.privateKey,
    256,
  );
  const ecdhSecret = new Uint8Array(sharedBits);

  // PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const keyInfo = concat(
    utf8("WebPush: info\0"),
    clientPub,
    ephemPub,
  );
  const prkKey = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prkKey, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prkKey, utf8("Content-Encoding: nonce\0"), 12);

  // Pad: payload || 0x02 (delimiter for last record)
  const plaintext = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource },
    aesKey,
    plaintext as BufferSource,
  );
  const ciphertext = new Uint8Array(ciphertextBuf);

  // aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // rs = 4096
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(ephemPub, 21);

  return { body: concat(header, ciphertext) };
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
};

export async function sendPush(
  sub: PushSubscription,
  payload: PushPayload,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<{ ok: boolean; status: number; expired?: boolean }> {
  const endpoint = sub.endpoint;
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const clientPub = bytesFromB64url(sub.p256dh);
  const authSecret = bytesFromB64url(sub.auth);
  const data = utf8(JSON.stringify(payload));
  const { body } = await encryptPayload(data, clientPub, authSecret);

  const auth = await buildVapidAuthHeader(audience);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts?.ttl ?? 60 * 60 * 24),
      Urgency: opts?.urgency ?? "normal",
    },
    body: body as BodyInit,
  });
  const expired = res.status === 404 || res.status === 410;
  if (!res.ok && !expired) {
    const txt = await res.text().catch(() => "");
    console.error(`[push] ${res.status} ${endpoint.slice(0, 60)}: ${txt.slice(0, 200)}`);
  }
  return { ok: res.ok, status: res.status, expired };
}

type PrefKey = "kickoff" | "goal" | "fulltime" | "squad" | "article";

export async function broadcast(
  prefKey: PrefKey,
  payload: PushPayload,
  dedupKey?: string,
): Promise<{ sent: number; expired: number; total: number; skipped?: boolean }> {
  // Dedup
  if (dedupKey) {
    const { data: existing } = await supabaseAdmin
      .from("notification_log")
      .select("dedup_key")
      .eq("dedup_key", dedupKey)
      .maybeSingle();
    if (existing) return { sent: 0, expired: 0, total: 0, skipped: true };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, prefs");
  const targets = (subs ?? []).filter((s) => {
    const p = (s.prefs as Record<string, boolean> | null) ?? {};
    return p[prefKey] !== false;
  });

  let sent = 0;
  let expired = 0;
  const expiredIds: string[] = [];
  await Promise.all(
    targets.map(async (s) => {
      try {
        const r = await sendPush(
          { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
          payload,
        );
        if (r.ok) sent++;
        if (r.expired) {
          expired++;
          expiredIds.push(s.id as string);
        }
      } catch (e) {
        console.error("[push] send error:", e);
      }
    }),
  );

  if (expiredIds.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
  }

  if (dedupKey) {
    await supabaseAdmin.from("notification_log").upsert({ dedup_key: dedupKey });
  }

  return { sent, expired, total: targets.length };
}
