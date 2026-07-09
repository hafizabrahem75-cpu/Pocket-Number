import { ReactNode } from 'react';

export function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-gray-200 flex justify-center overflow-hidden">
      <div className="w-full max-w-[428px] bg-background shadow-2xl relative flex flex-col min-h-[100dvh] overflow-y-auto overflow-x-hidden border-x border-gray-300">
        {children}
      </div>
    </div>
  );
}
