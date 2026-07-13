import { cn } from "@/lib/utils";

/** Tempo wordmark: a metronome-tick over a board diagonal. Original artwork. */
export function TempoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="7" className="fill-primary" />
      <path d="M9 23 L23 9" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
      <path d="M11 21 L16 9.5 L21 21" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="21.5" r="2.1" className="fill-[var(--primary-foreground)]" />
    </svg>
  );
}

export function TempoLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <TempoMark />
      <span className="text-lg">Tempo</span>
    </span>
  );
}
