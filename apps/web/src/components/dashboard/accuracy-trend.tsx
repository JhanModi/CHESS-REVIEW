"use client";

import { useMemo, useRef, useState } from "react";
import type { DashboardStatsDto } from "@tempo/types";

const W = 600;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 20, left: 30 };

/**
 * Single-series line: accuracy per analysed game, oldest → newest.
 * One axis, recessive grid, crosshair + tooltip on hover (no legend needed
 * for a single series — the card title names it).
 */
export function AccuracyTrend({ trend }: { trend: DashboardStatsDto["accuracyTrend"] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { points, yTicks } = useMemo(() => {
    const values = trend.map((t) => t.accuracy);
    const min = Math.max(0, Math.floor((Math.min(...values, 100) - 5) / 10) * 10);
    const max = 100;
    const x = (i: number) =>
      PAD.left + (trend.length === 1 ? 0.5 : i / (trend.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
    return {
      points: trend.map((t, i) => ({ x: x(i), y: y(t.accuracy), ...t })),
      yTicks: [min, (min + max) / 2, max].map((v) => ({ v, y: y(v) })),
    };
  }, [trend]);

  if (trend.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Analyse at least two games to see your trend.
      </p>
    );
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onPointerMove={(e) => {
          const rect = svgRef.current!.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          points.forEach((p, i) => {
            if (Math.abs(p.x - px) < Math.abs(points[best]!.x - px)) best = i;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
              {t.v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" />
        {hovered && (
          <>
            <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={H - PAD.bottom} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
            <circle cx={hovered.x} cy={hovered.y} r={4.5} fill="var(--color-primary)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(hovered.x / W) * 100}%`,
            transform: hovered.x > W / 2 ? "translateX(-105%)" : "translateX(6px)",
          }}
        >
          <span className="font-semibold tabular-nums">{hovered.accuracy.toFixed(1)}%</span>
          {hovered.playedAt && (
            <span className="text-muted-foreground"> · {new Date(hovered.playedAt).toLocaleDateString()}</span>
          )}
        </div>
      )}
    </div>
  );
}
