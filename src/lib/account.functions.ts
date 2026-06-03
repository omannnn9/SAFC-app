import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the authenticated user.
 * - Cascades: posts -> likes/saves/shares/comments via FK ON DELETE CASCADE (set in migration).
 * - Cleans: follows (both sides), event_attendees, event_photos, bookmarks,
 *   notifications, group_members, push_subscriptions, post_likes/saves/shares/comments on OTHERS' posts.
 * - Messages: kept (for the other party), profile is anonymized to "Deleted user".
 * - Finally removes the auth user (so they can never sign in again).
 *
 * Password re-verification is performed CLIENT-SIDE via `supabase.auth.signInWithPassword`
 * before this function is invoked. requireSupabaseAuth confirms the caller is the user.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    // 1. Delete user's own posts (cascades likes/saves/shares/comments on those posts)
    await supabaseAdmin.from("posts").delete().eq("user_id", uid);

    // 2. Remove interactions on OTHERS' content
    await Promise.all([
      supabaseAdmin.from("post_likes").delete().eq("user_id", uid),
      supabaseAdmin.from("post_saves").delete().eq("user_id", uid),
      supabaseAdmin.from("post_shares").delete().eq("user_id", uid),
      supabaseAdmin.from("post_comments").delete().eq("user_id", uid),
      supabaseAdmin.from("bookmarks").delete().eq("user_id", uid),
      supabaseAdmin.from("event_attendees").delete().eq("user_id", uid),
      supabaseAdmin.from("event_photos").delete().eq("user_id", uid),
      supabaseAdmin.from("group_members").delete().eq("user_id", uid),
      supabaseAdmin.from("notifications").delete().eq("user_id", uid),
      supabaseAdmin.from("push_subscriptions").delete().eq("user_id", uid),
      supabaseAdmin.from("follows").delete().eq("follower_id", uid),
      supabaseAdmin.from("follows").delete().eq("following_id", uid),
      supabaseAdmin.from("user_achievements").delete().eq("user_id", uid),
      supabaseAdmin.from("profile_visits").delete().eq("profile_id", uid),
      supabaseAdmin.from("profile_visits").delete().eq("visitor_id", uid),
      supabaseAdmin.from("user_roles").delete().eq("user_id", uid),
    ]);

    // 3. Anonymize the profile (preserves message attribution as "Deleted user")
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: "Deleted user",
        username: null,
        bio: null,
        avatar_url: null,
        cover_url: null,
        phone: null,
        city: null,
        favourite_team: null,
        interests: [],
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", uid);

    // 4. Remove the auth user (signs them out everywhere, prevents re-login)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
