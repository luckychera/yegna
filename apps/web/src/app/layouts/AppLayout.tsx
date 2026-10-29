import { Dialog as RadixDialog } from 'radix-ui';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import { BottomNav } from '@/components/layout/BottomNav';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';

/** Authenticated shell: fixed sidebar on desktop, slide-over drawer + bottom bar below `lg`. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-background lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block" aria-label="Sidebar">
        <SidebarNav />
      </aside>

      <RadixDialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-pop focus-visible:outline-none lg:hidden">
            <RadixDialog.Title className="sr-only">Navigation menu</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Links to every section of Yegna</RadixDialog.Description>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <TopBar onOpenMenu={() => setMenuOpen(true)} />

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
        <div key={location.pathname} className="animate-enter">
          <Outlet />
        </div>
      </main>

      <BottomNav onOpenMore={() => setMenuOpen(true)} />
    </div>
  );
}
