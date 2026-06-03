import { cn } from "@/lib/utils";
import logoAsset from "@/assets/safc-logo.png.asset.json";
import markAsset from "@/assets/safc-mark.png.asset.json";

/**
 * Official SAFC mark — uses the brand PNG provided in the design deck.
 * `variant="mark"` (default) → the green-square app icon (good on any background).
 * `variant="glyph"` → the standalone deconstructed SAFC letterforms (use on solid colour fields).
 */
export function SafcLogo({
  className,
  size = 40,
  variant = "mark",
}: {
  className?: string;
  size?: number;
  variant?: "mark" | "glyph";
}) {
  const src = variant === "glyph" ? logoAsset.url : markAsset.url;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="SAFC — South African Football Community"
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

/** Compact horizontal lockup: mark + SAFC wordmark */
export function SafcLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SafcLogo size={36} />
      <div className="leading-none">
        <div className="font-display text-[15px] font-extrabold tracking-tight">SAFC</div>
        <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Football&nbsp;Community
        </div>
      </div>
    </div>
  );
}
