"use client";

import { winPercentFromScore, type Score } from "@tempo/chess-core";
import { cn } from "@/lib/utils";

function formatScore(score: Score): string {
  if (score.mate !== undefined) return `M${Math.abs(score.mate)}`;
  const pawns = (score.cp ?? 0) / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

/** Vertical advantage bar; white's share grows from the bottom. */
export function EvalBar({
  score,
  orientation,
  className,
}: {
  score: Score | null;
  orientation: "white" | "black";
  className?: string;
}) {
  const whiteWin = score ? winPercentFromScore(score) : 50;
  const whiteFromBottom = orientation === "white";
  const whitePct = `${whiteWin}%`;
  const label = score ? formatScore(score) : "0.0";
  const whiteLeading = whiteWin >= 50;

  return (
    <div
      className={cn("relative h-full w-4 overflow-hidden rounded-md border md:w-5", className)}
      style={{ background: "var(--eval-black)" }}
      title={`White ${whiteWin.toFixed(0)}%`}
    >
      <div
        className="absolute inset-x-0 transition-[height] duration-300"
        style={{
          background: "var(--eval-white)",
          height: whitePct,
          ...(whiteFromBottom ? { bottom: 0 } : { top: 0 }),
        }}
      />
      <span
        className={cn(
          "absolute inset-x-0 text-center text-[8px] font-bold leading-4",
          whiteLeading === whiteFromBottom ? "bottom-0" : "top-0",
          whiteLeading ? "text-neutral-800" : "text-neutral-100",
        )}
      >
        {label}
      </span>
    </div>
  );
}
