import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md pb-32">
      <div className={`relative ${className}`}>{children}</div>
    </div>
  );
}
