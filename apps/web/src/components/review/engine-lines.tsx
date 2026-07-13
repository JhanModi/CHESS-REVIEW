"use client";

import type { MoveAnalysisDto } from "@tempo/types";
import { pvToSan } from "@/lib/board/san";
import { cn } from "@/lib/utils";

function formatCp(cp: number | null, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  const pawns = (cp ?? 0) / 100;
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

/**
 * Engine view of the CURRENT position: the analysis record of the next ply
 * holds the engine's evaluation of the position before that move.
 */
export function EngineLines({
  nextMoveAnalysis,
  fen,
  className,
}: {
  nextMoveAnalysis: MoveAnalysisDto | undefined;
  fen: string;
  className?: string;
}) {
  if (!nextMoveAnalysis) {
    return (
      <p className={cn("px-1 text-sm text-muted-foreground", className)}>
        No engine data for this position yet.
      </p>
    );
  }
  const pv = nextMoveAnalysis.bestLinePv.split(" ").filter(Boolean);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline gap-2 rounded-md border bg-card px-2.5 py-2">
        <span className="font-mono text-sm font-semibold text-primary">
          {formatCp(nextMoveAnalysis.evalBeforeCp, nextMoveAnalysis.evalBeforeMate)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={pvToSan(fen, pv, 16)}>
          {pvToSan(fen, pv, 10)}
        </span>
      </div>
      {nextMoveAnalysis.secondMoveUci && (
        <div className="flex items-baseline gap-2 rounded-md border bg-card/60 px-2.5 py-2">
          <span className="font-mono text-sm font-semibold text-muted-foreground">
            {formatCp(nextMoveAnalysis.secondCp, nextMoveAnalysis.secondMate)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {pvToSan(fen, [nextMoveAnalysis.secondMoveUci], 1)}
          </span>
        </div>
      )}
      <p className="px-1 text-[11px] text-muted-foreground">
        depth {nextMoveAnalysis.depth}
      </p>
    </div>
  );
}
