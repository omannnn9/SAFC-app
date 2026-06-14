import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { jsonResponse } from "@/lib/watchparty";

const USER_CONTENT_BUCKET = "user-content";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_PREFIXES = new Set(["avatar", "cover", "post", "msg"]);

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Upload service is not configured");
  }
  return { url, anonKey, serviceRoleKey };
}

function safeExt(file: File) {
  const byType = file.type.split("/")[1]?.toLowerCase();
  if (byType === "jpeg") return "jpg";
  if (byType && /^[a-z0-9]+$/.test(byType)) return byType;
  const byName = file.name.split(".").pop()?.toLowerCase();
  return byName && /^[a-z0-9]+$/.test(byName) ? byName : "jpg";
}

function safePrefix(raw: FormDataEntryValue | null) {
  const prefix = String(raw || "upload").trim().toLowerCase();
  if (ALLOWED_PREFIXES.has(prefix)) return prefix;
  if (/^event-[0-9a-f-]{8,}$/i.test(prefix)) return prefix;
  return "upload";
}

async function ensureUserContentBucket(admin: any) {
  const { data } = await admin.storage.getBucket(USER_CONTENT_BUCKET);
  if (data?.id === USER_CONTENT_BUCKET) return;

  const createRes = await admin.storage.createBucket(USER_CONTENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  });
  if (createRes.error && !/already exists|duplicate/i.test(createRes.error.message)) {
    throw createRes.error;
  }
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") || "";
          const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
          if (!token) return jsonResponse({ error: "Sign in to upload" }, { status: 401 });

          const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
          const userClient = createClient(url, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: authData, error: authError } = await userClient.auth.getUser(token);
          if (authError || !authData.user) {
            return jsonResponse({ error: "Invalid upload session" }, { status: 401 });
          }

          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return jsonResponse({ error: "Image file is required" }, { status: 400 });
          }
          if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return jsonResponse({ error: "Only JPEG, PNG, WebP, and GIF images are supported" }, { status: 400 });
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return jsonResponse({ error: "Images must be 10MB or smaller" }, { status: 400 });
          }

          const admin = createClient(url, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await ensureUserContentBucket(admin);

          const prefix = safePrefix(form.get("prefix"));
          const path = `${authData.user.id}/${prefix}-${Date.now()}.${safeExt(file)}`;
          const { error: uploadError } = await admin.storage
            .from(USER_CONTENT_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
          if (uploadError) throw uploadError;

          const { data: signed, error: signError } = await admin.storage
            .from(USER_CONTENT_BUCKET)
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
          if (signError || !signed?.signedUrl) throw signError ?? new Error("Failed to sign upload URL");

          return jsonResponse({ url: signed.signedUrl, path });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          return jsonResponse({ error: message }, { status: 500 });
        }
      },
    },
  },
});
