import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthenticatedSupabase = {
  supabase: SupabaseClient<Database>;
  user: User;
  userId: string;
};

function getSupabaseRuntimeEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }

  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

export async function getBearerToken() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: please sign in again");

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new Error("Unauthorized: please sign in again");
  return token;
}

export async function requireAuthenticatedSupabase(): Promise<AuthenticatedSupabase> {
  const token = await getBearerToken();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getSupabaseRuntimeEnv();
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) throw new Error("Unauthorized: please sign in again");

  return { supabase, user: data.user, userId: data.user.id };
}

export async function requireAdminUserId() {
  const token = await getBearerToken();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) throw new Error("Unauthorized: please sign in again");

  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!data) throw new Error("Forbidden: admin role required");
  return userId;
}

export async function requireAdminSupabase() {
  const auth = await requireAuthenticatedSupabase();
  const { data, error } = await auth.supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
  return auth;
}