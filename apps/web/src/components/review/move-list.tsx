"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MoveAnalysisDto, MoveDto } from "@tempo/types";
import { ClassificationBadge } from "@/components/review/classification-badge";
import { cn } from "@/lib/utils";

interface MoveListProps {
  moves: MoveDto[];
  analysis: Map<number, MoveAnalysisDto>;
  currentPly: number;
  onSelect: (ply: number) => void;
  className?: string;
}

function MoveCell({
  move,
  analysis,
  active,
  onSelect,
}: {
  move: MoveDto | undefined;
  analysis: MoveAnalysisDto | undefined;
  active: boolean;
  onSelect: (ply: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!move) return <div />;
  return (
    <button
      ref={ref}
      onClick={() => onSelect(move.ply)}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-left text-sm font-medium transition-colors cursor-pointer",
        active ? "bg-primary/15 text-primary" : "hover:bg-accent",
      )}
    >
      <span className="truncate">{move.san}</span>
      {analysis && <ClassificationBadge classification={analysis.classification} />}
    </button>
  );
}

export function MoveList({ moves, analysis, currentPly, onSelect, className }: MoveListProps) {
  const rows = useMemo(() => {
    const out: Array<{ number: number; white?: MoveDto; black?: MoveDto }> = [];
    for (const move of moves) {
      const number = Math.ceil(move.ply / 2);
      let row = out[number - 1];
      if (!row) {
        row = { number };
        out[number - 1] = row;
      }
      if (move.ply % 2 === 1) row.white = move;
      else row.black = move;
    }
    return out;
  }, [moves]);

  return (
    <div className={cn("overflow-y-auto", className)}>
      <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 gap-y-0.5 pr-1">
        {rows.map((row) => (
          <div key={row.number} className="contents">
            <div className="flex items-center px-1 text-xs tabular-nums text-muted-foreground">
              {row.number}.
            </div>
            <MoveCell
              move={row.white}
              analysis={row.white ? analysis.get(row.white.ply) : undefined}
              active={currentPly === row.white?.ply}
              onSelect={onSelect}
            />
            <MoveCell
              move={row.black}
              analysis={row.black ? analysis.get(row.black.ply) : undefined}
              active={currentPly === row.black?.ply}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
