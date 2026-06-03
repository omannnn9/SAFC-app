import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, Bookmark, CalendarDays, MoreHorizontal, Flag } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { togglePostLike, togglePostSave, recordShare } from "@/lib/social";
import type { FeedPost } from "@/lib/social";
import { db } from "@/lib/db";
import { toast } from "sonner";

export function PostCard({ post, onChange }: { post: FeedPost; onChange?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [likes, setLikes] = useState(post.likes);
  const [shares, setShares] = useState(post.shares);
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const onLike = async () => {
    if (!user) return toast.error("Sign in to like posts");
    if (pending) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
    try {
      await togglePostLike(post.id, user.id, !next);
      onChange?.();
    } catch {
      setLiked(!next);
      setLikes((c) => c + (next ? -1 : 1));
      toast.error("Could not update like");
    }
    setPending(false);
  };

  const onSave = async () => {
    if (!user) return toast.error("Sign in to save posts");
    const next = !saved;
    setSaved(next);
    try {
      await togglePostSave(post.id, user.id, !next);
      toast.success(next ? "Saved" : "Removed from saved");
    } catch {
      setSaved(!next);
      toast.error("Could not save");
    }
  };

  const onShare = async () => {
    const url = `${window.location.origin}/`;
    try {
      if (navigator.share) await navigator.share({ title: "Bafana Connect", text: post.body ?? "Check this out", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      if (user) { await recordShare(post.id, user.id); setShares((s) => s + 1); }
    } catch { /* user cancel */ }
  };

  const onReport = async () => {
    if (!user) return toast.error("Sign in to report");
    setMenuOpen(false);
    await db.from("reports").insert({
      reporter_id: user.id, target_type: "post", target_id: post.id, reason: "Reported from feed",
    });
    toast.success("Reported — thanks");
  };

  const when = new Date(post.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <article className="glass overflow-hidden rounded-2xl">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link to="/u/$id" params={{ id: post.user_id }}>
          <UserAvatar name={post.author?.full_name} src={post.author?.avatar_url} size={40} ring={post.author?.plan === "vip" ? "gold" : null} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/u/$id" params={{ id: post.user_id }} className="block truncate font-display text-sm font-black hover:text-primary">
            {post.author?.full_name ?? "Supporter"}
          </Link>
          <div className="text-[11px] text-muted-foreground">
            {post.author?.username ? `@${post.author.username} · ` : ""}{when}
          </div>
        </div>
        {post.author?.plan === "vip" && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">VIP</span>
        )}
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border">
              <button onClick={onReport} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/5">
                <Flag className="h-3.5 w-3.5" /> Report post
              </button>
            </div>
          )}
        </div>
      </header>

      {post.body && <p className="px-4 pt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{post.body}</p>}
      {post.image_url && (
        <div className="mt-3">
          <img src={post.image_url} alt="" className="max-h-[520px] w-full object-cover" loading="lazy" />
        </div>
      )}
      {post.event && (
        <Link
          to="/events/$id"
          params={{ id: post.event.id }}
          className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs"
        >
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span className="truncate font-semibold">{post.event.title}</span>
        </Link>
      )}

      <footer className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${liked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes}
        </button>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground">
          <MessageCircle className="h-4 w-4" /> {post.comments}
        </div>
        <button onClick={onShare} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <Share2 className="h-4 w-4" /> {shares > 0 ? shares : ""}
        </button>
        <button
          onClick={onSave}
          className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </footer>
    </article>
  );
}
