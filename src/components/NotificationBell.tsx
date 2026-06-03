import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchMyNotifications,
  fetchUnreadCount,
  markAllRead,
  markOneRead,
  subscribeToMyNotifications,
  type NotificationRow,
} from "@/lib/notifications";

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Initial count + realtime subscription
  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    fetchUnreadCount().then(setUnread).catch(() => {});
    unsub = subscribeToMyNotifications(user.id, (n) => {
      setUnread((c) => c + 1);
      setItems((prev) => [n, ...prev].slice(0, 30));
    });
    return () => {
      unsub?.();
    };
  }, [user]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPanel = async () => {
    setOpen((o) => !o);
    if (!open && user) {
      setLoading(true);
      const list = await fetchMyNotifications(30);
      setItems(list);
      setLoading(false);
    }
  };

  const onClear = async () => {
    if (!user) return;
    await markAllRead(user.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const onItemClick = async (n: NotificationRow) => {
    if (!n.read) {
      await markOneRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="glass relative grid h-9 w-9 place-items-center rounded-full transition hover:ring-glow-gold"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="font-display text-sm font-black">Notifications</div>
            {unread > 0 && (
              <button onClick={onClear} className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : (
              <ul className="divide-y divide-border/30">
                {items.map((n) => {
                  const content = (
                    <div className={`flex items-start gap-3 px-4 py-3 transition hover:bg-white/5 ${!n.read ? "bg-primary/5" : ""}`}>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{n.title}</div>
                        {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{relTime(n.created_at)}</div>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          onItemClick(n);
                          if (n.link) navigate({ to: n.link as string });
                        }}
                        className="block w-full text-left"
                      >
                        {content}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border/40 px-4 py-2.5 text-center text-xs font-bold text-primary hover:bg-white/5"
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}
