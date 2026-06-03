import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

/**
 * Floating "Sign up today" attention badge.
 * Pinned top-right on auth and landing screens.
 */
export function SignupBadge({ hideOn }: { hideOn?: "signup" }) {
  if (hideOn === "signup") return null;
  return (
    <Link
      to="/signup"
      className="group fixed right-3 top-3 z-50 sm:right-5 sm:top-5"
      aria-label="Sign up today and join the SAFC community"

    >
      <div className="relative">
        <span className="absolute -inset-1 rounded-full bg-[color:var(--sa-gold)]/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center gap-2 rounded-full bg-[color:var(--sa-gold)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black shadow-[0_10px_30px_-8px_rgba(255,215,0,0.6)] animate-[bounce_2.4s_ease-in-out_infinite]">
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={3} />
          <span className="hidden sm:inline">Join the Bafana Supporters Club</span>
          <span className="sm:hidden">Join Bafana SC</span>
        </div>

      </div>
    </Link>
  );
}
