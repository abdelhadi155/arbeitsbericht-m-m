import type { ReactNode } from "react";

interface SectionCardProps {
  id: string;
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}

export function SectionCard({ id, step, title, description, children, aside }: SectionCardProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-gold">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-lg font-bold leading-tight sm:text-xl">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}
