import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVapidPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidPublicKey } = await import("./vapid.server");
  return { publicKey: await getVapidPublicKey() };
});

const SubSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  userAgent: z.string().max(500).optional(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SubSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPushPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("endpoint, prefs, user_agent, created_at")
      .order("created_at", { ascending: false });
    return { subscriptions: data ?? [] };
  });

export const updatePushPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        prefs: z.object({
          kickoff: z.boolean(),
          goal: z.boolean(),
          fulltime: z.boolean(),
          squad: z.boolean(),
          article: z.boolean(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ prefs: data.prefs, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (!subs?.length) return { sent: 0 };
    const { sendPush } = await import("./push.server");
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "Bafana Supporters Club",
          body: "Notifications are working! 🇿🇦",
          url: "/",
          tag: "test",
        },
      );
      if (r.ok) sent++;
    }
    return { sent };
  });

// Admin-only: announce squad
export const broadcastSquadAnnounced = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ title: z.string().min(1).max(120), body: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");
    const { broadcast } = await import("./push.server");
    return broadcast(
      "squad",
      { title: data.title, body: data.body ?? "Tap to view the latest Bafana squad.", url: "/squad", tag: "squad" },
      `squad:${Date.now()}`,
    );
  });
