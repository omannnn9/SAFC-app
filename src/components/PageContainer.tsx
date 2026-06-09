import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md px-0 pb-32 sm:max-w-xl sm:px-4 md:max-w-none md:px-6 md:pb-10 lg:px-10 xl:px-14 2xl:px-20">
      <div className={`relative mx-auto w-full md:max-w-[1280px] xl:max-w-[1480px] 2xl:max-w-[1600px] ${className}`}>{children}</div>
    </div>
  );
}
