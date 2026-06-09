import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  isOnMembershipWaitlist,
  joinMembershipWaitlist,
} from "@/lib/membership.functions";

/**
 * Coming-soon panel shown wherever a user tries to upgrade or access a
 * paid SAFC feature. Replaces the previous mock payment flow.
 */
export function MembershipComingSoon({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const join = useServerFn(joinMembershipWaitlist);
  const check = useServerFn(isOnMembershipWaitlist);
  const [busy, setBusy] = useState(false);

  const statusQ = useQuery({
    queryKey: ["membership-waitlist", user?.id],
    queryFn: () => check(),
    enabled: !!user,
  });
  const joined = !!statusQ.data?.joined;

  const onJoin = async () => {
    if (!user) {
      toast.error("Sign in to be notified");
      return;
    }
    setBusy(true);
    try {
      await join();
      toast.success("You're on the list — we'll be in touch.");
      qc.invalidateQueries({ queryKey: ["membership-waitlist", user.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-[var(--safc-yellow)]/30 bg-gradient-to-br from-[var(--safc-green)]/25 via-[#0b0b0b] to-[var(--safc-cobalt)]/30 ${compact ? "p-5" : "p-6 sm:p-8"}`}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--safc-yellow)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[var(--safc-pink)]/15 blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--safc-yellow)]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--safc-yellow)]">
          <Crown className="h-3 w-3" /> SAFC Memberships
        </div>
        <h2 className={`mt-3 font-display font-black tracking-tight text-white ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
          Premium Memberships Coming Soon
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
          SAFC membership plans are currently being finalised. Premium memberships, Founding Member packages, exclusive benefits and supporter rewards will be launching soon.
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
          Stay tuned. We are building something special for South African football supporters.
        </p>

        <button
          onClick={onJoin}
          disabled={busy || joined || statusQ.isLoading}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow-pink)] transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : joined ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {joined ? "You're on the list" : "Notify Me When Memberships Launch"}
        </button>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          <Sparkles className="h-3 w-3 text-[var(--safc-yellow)]" />
          By the fans · For the fans
        </div>
      </div>
    </div>
  );
}

export function MembershipComingSoonModal({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {title && (
          <div className="absolute left-6 top-5 z-10 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
            {title}
          </div>
        )}
        <MembershipComingSoon compact />
      </div>
    </div>
  );
}
