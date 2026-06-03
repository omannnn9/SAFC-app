import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, CalendarDays } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { togglePostLike } from "@/lib/social";
import type { FeedPost } from "@/lib/social";
import { toast } from "sonner";

export function PostCard({ post, onChange }: { post: FeedPost; onChange?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [count, setCount] = useState(post.likes);
  const [pending, setPending] = useState(false);

  const onLike = async () => {
    if (!user) return toast.error("Sign in to like posts");
    if (pending) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await togglePostLike(post.id, user.id, !next ? true : false);
      onChange?.();
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.error("Could not update like");
    }
    setPending(false);
  };

  const when = new Date(post.created_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

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
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {count}
        </button>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground">
          <MessageCircle className="h-4 w-4" /> {post.comments}
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.origin + "/").catch(() => {});
            toast.success("Link copied");
          }}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
