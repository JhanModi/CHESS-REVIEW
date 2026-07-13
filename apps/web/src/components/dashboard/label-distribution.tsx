"use client";

import type { DashboardStatsDto, MoveClassification } from "@tempo/types";
import { ClassificationBadge, CLASSIFICATION_META } from "@/components/review/classification-badge";

const ORDER: MoveClassification[] = [
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

/**
 * Horizontal bars of the user's own move classifications. Identity is
 * carried by glyph + text label, colour is reinforcement (CVD-safe).
 */
export function LabelDistribution({ distribution }: { distribution: DashboardStatsDto["labelDistribution"] }) {
  const rows = ORDER.map((label) => ({ label, count: distribution[label] ?? 0 })).filter((r) => r.count > 0);
  const max = Math.max(...rows.map((r) => r.count), 1);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Analyse a game to see your move-quality profile.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <ClassificationBadge classification={row.label} />
            <span className="text-xs text-muted-foreground">
              {CLASSIFICATION_META[row.label].label}
            </span>
          </span>
          <div className="h-3.5 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(row.count / max) * 100}%`,
                backgroundColor: `var(${CLASSIFICATION_META[row.label].varName})`,
              }}
            />
          </div>
          <span className="text-right text-xs tabular-nums text-muted-foreground">{row.count}</span>
        </div>
      ))}
    </div>
  );
}
