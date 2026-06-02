import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-24">
      <div className={className}>{children}</div>
    </div>
  );
}
