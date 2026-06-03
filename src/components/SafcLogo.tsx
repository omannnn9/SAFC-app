import { cn } from "@/lib/utils";

/**
 * SAFC mark — deconstructed "SAFC" with triangle confetti accents,
 * inspired by the official brand deck (page 3 / page 13).
 */
export function SafcLogo({
  className,
  size = 40,
  withBackdrop = true,
}: {
  className?: string;
  size?: number;
  withBackdrop?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="SAFC"
      role="img"
    >
      {withBackdrop && (
        <rect width="64" height="64" rx="14" fill="var(--safc-green)" />
      )}
      {/* S */}
      <path d="M11 14h13v5H16v3h8v12H11v-5h8v-3h-8z" fill="#fff" />
      {/* A */}
      <path d="M27 34V14h12v5h-7v3h7v5h-7v7z" fill="#fff" />
      {/* F */}
      <path d="M11 36h12v5h-7v3h7v5h-7v6h-5z" fill="#fff" />
      {/* C */}
      <path d="M27 41a5 5 0 0 1 5-5h9v5h-9v9h9v5h-9a5 5 0 0 1-5-5z" fill="#fff" />
      {/* Triangle confetti */}
      <polygon points="42,14 49,14 45.5,20" fill="var(--safc-red)" />
      <polygon points="50,20 57,20 53.5,26" fill="var(--safc-cobalt)" />
      <polygon points="44,28 51,28 47.5,34" fill="var(--safc-yellow)" />
      <polygon points="50,46 57,46 53.5,52" fill="var(--safc-pink)" />
      <polygon points="42,55 49,55 45.5,49" fill="var(--safc-red)" />
    </svg>
  );
}

/** Compact horizontal lockup: mark + SAFC wordmark */
export function SafcLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SafcLogo size={36} />
      <div className="leading-none">
        <div className="font-display text-[15px] font-extrabold tracking-tight">SAFC</div>
        <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Football&nbsp;Community
        </div>
      </div>
    </div>
  );
}
