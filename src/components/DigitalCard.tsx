import { TIERS, tierTone, formatMemberNo, type Tier } from "@/lib/tiers";
import { SafcLogo } from "@/components/SafcLogo";

type Props = {
  tier: Tier;
  fullName: string | null;
  avatarUrl?: string | null;
  memberNo: number | null | undefined;
  isFounder?: boolean;
  joinedAt?: string | null;
};

export function DigitalCard({ tier, fullName, avatarUrl, memberNo, isFounder, joinedAt }: Props) {
  const def = TIERS.find((t) => t.id === tier) ?? TIERS[0];
  const tone = tierTone(tier);
  const isFounderCard = isFounder || tier === "founder";
  const isAnimated = tier === "premium" || isFounderCard;
  const joined = joinedAt ? new Date(joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—";

  return (
    <div className="relative mx-auto w-full max-w-md select-none [perspective:1200px]">
      {/* animated gradient border */}
      <div
        className={`relative rounded-3xl p-[2px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ${isAnimated ? "safc-card-glow" : ""}`}
        style={{ background: tone.grad, backgroundSize: "200% 200%" }}
      >
        <div className="relative overflow-hidden rounded-[22px] bg-[#0b0b0b] p-5 text-white">
          {/* subtle radial highlight */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full" style={{ background: tone.grad, opacity: 0.25, filter: "blur(36px)" }} />

          {/* shine sweep on premium / founder */}
          {isAnimated && <span className="safc-card-shine" />}

          {/* Top row */}
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2">
              <SafcLogo className="h-9 w-9" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">South African Football Community</div>
                <div className="font-display text-base font-black tracking-tight">We are SA FC</div>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone.bg} ${tone.text} ring-1 ${tone.ring}/50`}>
              {def.badge}
            </span>
          </div>

          {/* Founder stamp */}
          {isFounderCard && (
            <div className="absolute right-4 top-16 rotate-[8deg] rounded-md border-2 border-[var(--safc-yellow)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--safc-yellow)] shadow-[0_0_24px_rgba(245,208,45,0.45)]">
              Founding Member<br />Starting XI
            </div>
          )}

          {/* Member */}
          <div className="relative mt-8 flex items-end gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/30">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName ?? "Member"} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-lg font-black">
                  {(fullName ?? "S").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Member</div>
              <div className="truncate font-display text-xl font-black tracking-tight">{fullName || "Supporter"}</div>
            </div>
          </div>

          {/* Footer row */}
          <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-[10px]">
            <div>
              <div className="font-bold uppercase tracking-[0.2em] text-white/50">Member No.</div>
              <div className={`mt-0.5 font-display text-sm font-black ${isFounderCard ? "text-[var(--safc-yellow)]" : "text-white"}`}>{formatMemberNo(memberNo)}</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.2em] text-white/50">Tier</div>
              <div className="mt-0.5 font-display text-sm font-black">{def.name.split(" — ")[0]}</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.2em] text-white/50">Joined</div>
              <div className="mt-0.5 font-display text-sm font-black">{joined}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
