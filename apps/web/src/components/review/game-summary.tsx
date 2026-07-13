"use client";

import type { AnalysisDto, MoveClassification, MoveDto } from "@tempo/types";
import { ClassificationBadge } from "@/components/review/classification-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shape of Analysis.summary as produced by @tempo/chess-core summarizeGame. */
interface SummaryJson {
  labelCounts?: { white?: Partial<Record<string, number>>; black?: Partial<Record<string, number>> };
  turningPoints?: Array<{ ply: number; swing: number }>;
  bestPly?: { white: number | null; black: number | null };
  worstPly?: { white: number | null; black: number | null };
  opening?: { eco: string; name: string; lastBookPly: number } | null;
  phases?: { openingEndPly: number; endgameStartPly: number | null };
  phaseAccuracy?: Record<string, { white: number | null; black: number | null }>;
}

const COUNT_ORDER: MoveClassification[] = [
  "BRILLIANT",
  "GREAT",
  "BEST",
  "EXCELLENT",
  "GOOD",
  "BOOK",
  "INACCURACY",
  "MISTAKE",
  "BLUNDER",
  "MISS",
  "FORCED",
];

function AccuracyRing({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full border-4 text-lg font-bold tabular-nums",
          value === null
            ? "border-muted text-muted-foreground"
            : value >= 90
              ? "border-[var(--cls-best)]"
              : value >= 75
                ? "border-[var(--cls-inaccuracy)]"
                : "border-[var(--cls-blunder)]",
        )}
      >
        {value === null ? "—" : value.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function GameSummaryPanel({
  analysis,
  moves,
  whiteName,
  blackName,
  onSelect,
}: {
  analysis: AnalysisDto;
  moves: MoveDto[];
  whiteName: string;
  blackName: string;
  onSelect: (ply: number) => void;
}) {
  const summary = (analysis.summary ?? {}) as SummaryJson;
  const counts = summary.labelCounts ?? {};
  const sanOf = (ply: number | null | undefined): string | null => {
    if (!ply) return null;
    const move = moves.find((m) => m.ply === ply);
    return move ? `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "…"} ${move.san}` : null;
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-center justify-around p-4">
          <AccuracyRing value={analysis.accuracyWhite} label={whiteName} />
          <div className="text-center text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Accuracy</p>
            <p className="mt-1">
              ACPL {analysis.acplWhite ?? "—"} · {analysis.acplBlack ?? "—"}
            </p>
          </div>
          <AccuracyRing value={analysis.accuracyBlack} label={blackName} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-1 text-sm">
            <span />
            <span className="text-xs font-medium text-muted-foreground">White</span>
            <span className="text-xs font-medium text-muted-foreground">Black</span>
            {COUNT_ORDER.map((label) => {
              const white = counts.white?.[label.toLowerCase()] ?? 0;
              const black = counts.black?.[label.toLowerCase()] ?? 0;
              if (white === 0 && black === 0) return null;
              return (
                <div key={label} className="contents">
                  <span className="flex items-center gap-2">
                    <ClassificationBadge classification={label} />
                    <span className="text-muted-foreground">{label.toLowerCase()}</span>
                  </span>
                  <span className="text-right tabular-nums">{white}</span>
                  <span className="text-right tabular-nums">{black}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(summary.turningPoints?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Turning points</p>
            <div className="space-y-1">
              {summary.turningPoints!.map((tp) => (
                <button
                  key={tp.ply}
                  onClick={() => onSelect(tp.ply)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent cursor-pointer"
                >
                  <span>{sanOf(tp.ply)}</span>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      tp.swing > 0 ? "text-[var(--cls-best)]" : "text-[var(--cls-blunder)]",
                    )}
                  >
                    {tp.swing > 0 ? "+" : ""}
                    {tp.swing.toFixed(0)}% white
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(summary.worstPly?.white || summary.worstPly?.black) && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm">
            {summary.worstPly?.white && (
              <button className="rounded-md border p-2 text-left hover:bg-accent cursor-pointer" onClick={() => onSelect(summary.worstPly!.white!)}>
                <p className="text-xs text-muted-foreground">White&apos;s worst</p>
                <p className="font-medium">{sanOf(summary.worstPly.white)}</p>
              </button>
            )}
            {summary.worstPly?.black && (
              <button className="rounded-md border p-2 text-left hover:bg-accent cursor-pointer" onClick={() => onSelect(summary.worstPly!.black!)}>
                <p className="text-xs text-muted-foreground">Black&apos;s worst</p>
                <p className="font-medium">{sanOf(summary.worstPly.black)}</p>
              </button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
