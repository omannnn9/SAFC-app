import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { broadcastSquadAnnounced } from "@/lib/push.functions";

export function SquadAdminBroadcast() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("New Bafana squad announced");
  const [body, setBody] = useState("Tap to view the latest call-up.");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(broadcastSquadAnnounced);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  if (!isAdmin) return null;

  const fire = async () => {
    setBusy(true);
    try {
      const r = await send({ data: { title, body } });
      toast.success(`Sent to ${r.sent} of ${r.total} subscribers`);
      setOpen(false);
    } catch (e) {
      toast.error("Couldn't send");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider text-primary transition hover:ring-glow-gold"
        >
          <Megaphone className="h-4 w-4" /> Send squad-announced alert
        </button>
      ) : (
        <div className="glass space-y-2 rounded-2xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Push to all subscribers
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            placeholder="Title"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            placeholder="Message body"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg bg-surface-2 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={fire}
              disabled={busy || !title}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Send now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
