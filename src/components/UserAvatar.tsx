import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  src,
  size = 40,
  className,
  ring,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: "gold" | "green" | null;
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const ringCls = ring === "gold" ? "ring-glow-gold" : ring === "green" ? "ring-glow-green" : "";
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--sa-green)] font-display font-black text-white",
        ringCls,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? <img src={src} alt={name ?? ""} className="h-full w-full object-cover" /> : initials || "?"}
    </div>
  );
}
