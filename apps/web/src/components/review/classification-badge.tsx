import type { MoveClassification } from "@tempo/types";
import { cn } from "@/lib/utils";

/** Original glyph set — symbol + token colour per classification. */
export const CLASSIFICATION_META: Record<
  MoveClassification,
  { symbol: string; label: string; varName: string }
> = {
  BRILLIANT: { symbol: "!!", label: "Brilliant", varName: "--cls-brilliant" },
  GREAT: { symbol: "!", label: "Great", varName: "--cls-great" },
  BEST: { symbol: "★", label: "Best", varName: "--cls-best" },
  EXCELLENT: { symbol: "✓", label: "Excellent", varName: "--cls-excellent" },
  GOOD: { symbol: "○", label: "Good", varName: "--cls-good" },
  BOOK: { symbol: "≡", label: "Book", varName: "--cls-book" },
  INACCURACY: { symbol: "?!", label: "Inaccuracy", varName: "--cls-inaccuracy" },
  MISTAKE: { symbol: "?", label: "Mistake", varName: "--cls-mistake" },
  BLUNDER: { symbol: "??", label: "Blunder", varName: "--cls-blunder" },
  MISS: { symbol: "✗", label: "Miss", varName: "--cls-miss" },
  FORCED: { symbol: "→", label: "Forced", varName: "--cls-forced" },
};

/** Which classifications matter enough to mark on the board / graph. */
export const NOTABLE_CLASSIFICATIONS: ReadonlySet<MoveClassification> = new Set([
  "BRILLIANT",
  "GREAT",
  "INACCURACY",
  "MISTAKE",
  "BLUNDER",
  "MISS",
]);

export function ClassificationBadge({
  classification,
  size = "sm",
  className,
}: {
  classification: MoveClassification;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = CLASSIFICATION_META[classification];
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "sm" ? "h-4 min-w-4 px-0.5 text-[9px]" : "h-6 min-w-6 px-1 text-[11px]",
        className,
      )}
      style={{ backgroundColor: `var(${meta.varName})` }}
    >
      {meta.symbol}
    </span>
  );
}
