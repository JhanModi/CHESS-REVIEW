"use client";

import { useMemo, useRef, useState } from "react";
import type { MoveAnalysisDto, MoveDto } from "@tempo/types";
import {
  CLASSIFICATION_META,
  NOTABLE_CLASSIFICATIONS,
} from "@/components/review/classification-badge";
import { cn } from "@/lib/utils";

const W = 1000;
const H = 220;

/** White-POV win% after each ply (index 0 = start position). */
function whiteWinSeries(moves: MoveAnalysisDto[], totalPlies: number): number[] {
  const series: number[] = [50];
  for (let ply = 1; ply <= totalPlies; ply++) {
    const ma = moves.find((m) => m.ply === ply);
    if (!ma) {
      series.push(series.at(-1)!);
      continue;
    }
    const whiteWin = ply % 2 === 1 ? ma.winAfter : 100 - ma.winAfter;
    series.push(whiteWin);
  }
  if (moves[0]) series[0] = moves[0].ply % 2 === 1 ? moves[0].winBefore : 100 - moves[0].winBefore;
  return series;
}

function formatEval(ma: MoveAnalysisDto): string {
  if (ma.evalAfterMate !== null) return `M${Math.abs(ma.evalAfterMate)}`;
  const pawns = (ma.evalAfterCp ?? 0) / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

export function EvalGraph({
  moves,
  gameMoves,
  totalPlies,
  currentPly,
  onSelect,
  className,
}: {
  moves: MoveAnalysisDto[];
  gameMoves: MoveDto[];
  totalPlies: number;
  currentPly: number;
  onSelect: (ply: number) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  const series = useMemo(() => whiteWinSeries(moves, totalPlies), [moves, totalPlies]);
  const x = (ply: number) => (totalPlies === 0 ? 0 : (ply / totalPlies) * W);
  const y = (win: number) => H - (win / 100) * H;

  const areaPath = useMemo(() => {
    if (series.length < 2) return "";
    const points = series.map((win, ply) => `${x(ply).toFixed(1)},${y(win).toFixed(1)}`);
    return `M0,${H} L${points.join(" L")} L${W},${H} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, totalPlies]);

  const notable = useMemo(
    () => moves.filter((m) => NOTABLE_CLASSIFICATIONS.has(m.classification)),
    [moves],
  );

  function plyFromEvent(event: { clientX: number }): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const frac = (event.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(totalPlies, Math.round(frac * totalPlies)));
  }

  const hovered = hoverPly !== null ? moves.find((m) => m.ply === hoverPly) : undefined;
  const hoveredMove = hoverPly !== null ? gameMoves.find((m) => m.ply === hoverPly) : undefined;

  if (totalPlies === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full cursor-crosshair rounded-md border md:h-28"
        style={{ background: "var(--eval-black)" }}
        onPointerMove={(e) => setHoverPly(plyFromEvent(e))}
        onPointerLeave={() => setHoverPly(null)}
        onClick={(e) => onSelect(plyFromEvent(e))}
      >
        <path d={areaPath} fill="var(--eval-white)" opacity={0.92} />
        {/* midline: the 50% equality line */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.6} />

        {/* notable-move markers (colour + tooltip text, never colour alone) */}
        {notable.map((m) => (
          <circle
            key={m.ply}
            cx={x(m.ply)}
            cy={y(series[m.ply] ?? 50)}
            r={7}
            fill={`var(${CLASSIFICATION_META[m.classification].varName})`}
            stroke="var(--eval-black)"
            strokeWidth={2}
          />
        ))}

        {/* current position cursor */}
        <line x1={x(currentPly)} y1={0} x2={x(currentPly)} y2={H} stroke="var(--color-primary)" strokeWidth={2.5} />
        {hoverPly !== null && (
          <line x1={x(hoverPly)} y1={0} x2={x(hoverPly)} y2={H} stroke="var(--muted-foreground)" strokeWidth={1.5} opacity={0.7} />
        )}
      </svg>

      {hoverPly !== null && hoverPly > 0 && hovered && hoveredMove && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(hoverPly / totalPlies) * 100}%`, transform: `translate(${hoverPly > totalPlies / 2 ? "-100%" : "0"}, -100%)` }}
        >
          <span className="font-medium">
            {Math.ceil(hoverPly / 2)}
            {hoverPly % 2 === 1 ? "." : "…"} {hoveredMove.san}
          </span>{" "}
          <span className="text-muted-foreground">{formatEval(hovered)}</span>{" "}
          <span style={{ color: `var(${CLASSIFICATION_META[hovered.classification].varName})` }}>
            {CLASSIFICATION_META[hovered.classification].label}
          </span>
        </div>
      )}
    </div>
  );
}
