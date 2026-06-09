import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSupabase, requireAuthenticatedSupabase } from "@/lib/server-auth";

const TierEnum = z.enum(["free", "basic", "premium", "founder"]);

export const listTierConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tier_config")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getMyMembership = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabase, userId } = await requireAuthenticatedSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, tier, member_no, is_founder, founder_at, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const adminUpdateTier = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: TierEnum,
        name: z.string().min(1).max(120),
        tagline: z.string().max(200).nullable(),
        price_cents: z.number().int().min(0),
        perks: z.array(z.string().min(1).max(200)).max(40),
        visible: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase
      .from("tier_config")
      .update({
        name: data.name,
        tagline: data.tagline,
        price_cents: data.price_cents,
        perks: data.perks,
        visible: data.visible,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserTier = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), tier: TierEnum }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } =
      data.tier === "founder"
        ? await supabase.from("profiles").update({ tier: "founder", is_founder: true }).eq("id", data.userId)
        : await supabase.from("profiles").update({ tier: data.tier, is_founder: false, founder_at: null }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAssignFounder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ is_founder: true, tier: "founder" })
      .eq("id", data.userId);
    if (error) throw new Error(error.message); // trigger raises if cap hit
    return { ok: true };
  });

export const adminRevokeFounder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ is_founder: false, founder_at: null, tier: "free" })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFoundersList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, avatar_url, member_no, founder_at")
    .eq("is_founder", true)
    .order("member_no", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getFoundersCount = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_founder", true);
  return { count: count ?? 0, cap: 111 };
});
