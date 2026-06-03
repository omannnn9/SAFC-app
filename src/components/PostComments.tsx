import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Send, MoreHorizontal, Pencil, Trash2, Flag, Check, X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toast } from "sonner";

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  author: { full_name: string; username: string | null; avatar_url: string | null } | null;
};

export function PostComments({ postId, onCountChange }: { postId: string; onCountChange?: (n: number) => void }) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await db
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at, updated_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as CommentRow[];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await db.from("profiles").select("id, full_name, username, avatar_url").in("id", ids);
      const m = new Map(((profs ?? []) as { id: string; full_name: string; username: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
      rows.forEach((r) => (r.author = m.get(r.user_id) ?? null));
    }
    setItems(rows);
    setLoading(false);
    onCountChange?.(rows.length);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [postId]);

  const submit = async () => {
    if (!user) return toast.error("Sign in to comment");
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) return toast.error("Max 500 characters");
    setBusy(true);
    const { error } = await db.from("post_comments").insert({ post_id: postId, user_id: user.id, body: trimmed });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
  };

  return (
    <div className="border-t border-border/40 px-4 py-3">
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="py-2 text-center text-xs text-muted-foreground">Be the first to comment</div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <CommentItem key={c.id} comment={c} currentUserId={user?.id ?? null} onChanged={load} />
          ))}
        </ul>
      )}

      {user && (
        <div className="mt-3 flex items-start gap-2">
          <UserAvatar name={profile?.full_name} src={profile?.avatar_url} size={32} />
          <div className="flex flex-1 items-end gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={1}
              placeholder="Write a comment…"
              maxLength={500}
              className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
            />
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, currentUserId, onChanged }: { comment: CommentRow; currentUserId: string | null; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const isOwner = currentUserId === comment.user_id;
  const edited = comment.updated_at && comment.updated_at !== comment.created_at &&
    Math.abs(new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime()) > 1000;

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return toast.error("Comment cannot be empty");
    if (trimmed.length > 500) return toast.error("Max 500 characters");
    setBusy(true);
    const { error } = await db.from("post_comments").update({ body: trimmed }).eq("id", comment.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm("Delete this comment?")) return;
    setMenuOpen(false);
    const { error } = await db.from("post_comments").delete().eq("id", comment.id);
    if (error) return toast.error(error.message);
    toast.success("Comment deleted");
    onChanged();
  };

  const report = async () => {
    if (!currentUserId) return toast.error("Sign in to report");
    setMenuOpen(false);
    await db.from("reports").insert({
      reporter_id: currentUserId, target_type: "comment", target_id: comment.id, reason: "Reported from feed",
    });
    toast.success("Reported — thanks");
  };

  const when = new Date(comment.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <li className="flex items-start gap-2">
      <Link to="/u/$id" params={{ id: comment.user_id }}>
        <UserAvatar name={comment.author?.full_name} src={comment.author?.avatar_url} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Link to="/u/$id" params={{ id: comment.user_id }} className="truncate text-xs font-black hover:text-primary">
              {comment.author?.full_name ?? "Supporter"}
            </Link>
            <span className="text-[10px] text-muted-foreground">{when}{edited ? " · edited" : ""}</span>
            <div className="relative ml-auto">
              <button onClick={() => setMenuOpen((o) => !o)} className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-white/5">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border">
                  {isOwner ? (
                    <>
                      <button onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-white/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </>
                  ) : (
                    <button onClick={report} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"><Flag className="h-3.5 w-3.5" /> Report</button>
                  )}
                </div>
              )}
            </div>
          </div>
          {editing ? (
            <div className="mt-1">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={500}
                className="w-full resize-none rounded-md bg-background px-2 py-1 text-sm outline-none ring-1 ring-border focus:ring-primary" />
              <div className="mt-1 flex gap-2">
                <button onClick={save} disabled={busy} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
                <button onClick={() => { setEditing(false); setDraft(comment.body); }} className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-bold">
                  <X className="h-3 w-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug">{comment.body}</p>
          )}
        </div>
      </div>
    </li>
  );
}
