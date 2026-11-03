import type { ReactNode } from 'react';
import { Logo, ScreenTitle } from '@/ui';

/** The page every screen before the workspace sits on: one scrolling column. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-[400px] flex-col gap-5 px-5 py-6">{children}</div>
    </main>
  );
}

/** Mark, title (focused when the screen appears) and one sentence of context. */
export function Hero({ title, lead, logo = false }: { title: ReactNode; lead: ReactNode; logo?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {logo && <Logo size={36} />}
      <div className="flex flex-col gap-1.5">
        <ScreenTitle>{title}</ScreenTitle>
        <p className="text-body text-ink-600">{lead}</p>
      </div>
    </div>
  );
}
