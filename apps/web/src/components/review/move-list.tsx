"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MoveAnalysisDto, MoveClassification, MoveDto } from "@tempo/types";
import { BestMoveBadge } from "@/components/review/best-move-badge";
import { ClassificationBadge } from "@/components/review/classification-badge";
import { sanOfUci } from "@/lib/board/variation";
import { cn } from "@/lib/utils";

const HINTED: ReadonlySet<MoveClassification> = new Set(["INACCURACY", "MISTAKE", "BLUNDER", "MISS"]);

interface MoveListProps {
  moves: MoveDto[];
  analysis: Map<number, MoveAnalysisDto>;
  /** FEN of the game's starting position (for best-move SAN derivation). */
  initialFen: string;
  currentPly: number;
  onSelect: (ply: number) => void;
  className?: string;
}

function MoveCell({
  move,
  analysis,
  bestSan,
  active,
  onSelect,
}: {
  move: MoveDto | undefined;
  analysis: MoveAnalysisDto | undefined;
  bestSan: string | null;
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
      {bestSan && <BestMoveBadge bestSan={bestSan} />}
    </button>
  );
}

export function MoveList({ moves, analysis, initialFen, currentPly, onSelect, className }: MoveListProps) {
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

  // Best-move SAN for hinted (bad) moves only — derived from stored data.
  const bestSanByPly = useMemo(() => {
    const map = new Map<number, string>();
    for (const move of moves) {
      const ma = analysis.get(move.ply);
      if (!ma || !HINTED.has(ma.classification) || ma.bestMoveUci === move.uci) continue;
      const fenBefore = move.ply === 1 ? initialFen : (moves[move.ply - 2]?.fenAfter ?? null);
      if (!fenBefore) continue;
      const san = sanOfUci(fenBefore, ma.bestMoveUci);
      if (san) map.set(move.ply, san);
    }
    return map;
  }, [moves, analysis, initialFen]);

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
              bestSan={row.white ? (bestSanByPly.get(row.white.ply) ?? null) : null}
              active={currentPly === row.white?.ply}
              onSelect={onSelect}
            />
            <MoveCell
              move={row.black}
              analysis={row.black ? analysis.get(row.black.ply) : undefined}
              bestSan={row.black ? (bestSanByPly.get(row.black.ply) ?? null) : null}
              active={currentPly === row.black?.ply}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
