import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md px-0 pb-32 sm:max-w-xl sm:px-4 md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
      <div className={`relative ${className}`}>{children}</div>
    </div>
  );
}
