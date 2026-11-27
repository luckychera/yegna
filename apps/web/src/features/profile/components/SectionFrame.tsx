import type { ReactNode } from 'react';

export function SectionFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-body text-ink-secondary">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
