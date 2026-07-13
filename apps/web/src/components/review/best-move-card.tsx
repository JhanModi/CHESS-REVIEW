"use client";

import { Check, Flame, ListVideo, Play, Sparkles, X } from "lucide-react";
import { useMemo } from "react";
import type { MoveAnalysisDto, MoveDto } from "@tempo/types";
import { CLASSIFICATION_META } from "@/components/review/classification-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { replayLine } from "@/lib/board/variation";
import { useReviewStore } from "@/stores/review-store";
import { cn } from "@/lib/utils";

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  const pawns = (cp ?? 0) / 100;
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

interface Verdict {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  body: string;
}

function verdictFor(ma: MoveAnalysisDto, playedBest: boolean, bestSan: string | null): Verdict {
  const bestEval = formatEval(ma.evalBeforeCp, ma.evalBeforeMate);
  const playedEval = formatEval(ma.evalAfterCp, ma.evalAfterMate);
  const pawnsLost = (ma.cpLoss / 100).toFixed(1);

  if (ma.classification === "BRILLIANT") {
    return {
      icon: Flame,
      tone: "text-[var(--cls-brilliant)]",
      title: "Brilliant!",
      body: "You found Stockfish's top move — a sacrifice that works. Play the engine line to understand why.",
    };
  }
  if (playedBest) {
    return {
      icon: Check,
      tone: "text-[var(--cls-best)]",
      title: "You played the engine's best move.",
      body: "Follow the engine line to see the strongest continuation from here.",
    };
  }
  if (ma.classification === "BLUNDER") {
    return {
      icon: X,
      tone: "text-[var(--cls-blunder)]",
      title: `Best was ${bestSan ?? ma.bestMoveUci}`,
      body: `Your move loses about ${pawnsLost} pawns. Play the engine continuation to see the punishment.`,
    };
  }
  if (ma.classification === "MISTAKE" || ma.classification === "MISS" || ma.classification === "INACCURACY") {
    return {
      icon: X,
      tone: `text-[var(${CLASSIFICATION_META[ma.classification].varName})]`,
      title: `Better was ${bestSan ?? ma.bestMoveUci}`,
      body: `It keeps ${bestEval}; your move gave ${playedEval}.`,
    };
  }
  return {
    icon: Sparkles,
    tone: "text-muted-foreground",
    title: `Engine preferred ${bestSan ?? ma.bestMoveUci}`,
    body: `A small refinement: ${bestEval} instead of ${playedEval}.`,
  };
}

/**
 * The learning card for the selected move: what the engine wanted, how much
 * the played move cost, and playback of the stored line. Reads only stored
 * analysis — never triggers engine or network work.
 */
export function BestMoveCard({
  move,
  moveAnalysis,
  fenBefore,
}: {
  move: MoveDto;
  moveAnalysis: MoveAnalysisDto;
  fenBefore: string;
}) {
  const enterVariation = useReviewStore((s) => s.enterVariation);

  const pv = useMemo(() => moveAnalysis.bestLinePv.split(" ").filter(Boolean), [moveAnalysis.bestLinePv]);
  const pvSteps = useMemo(() => replayLine(fenBefore, pv), [fenBefore, pv]);
  const bestSan = pvSteps[0]?.san ?? null;
  const playedBest = moveAnalysis.bestMoveUci === move.uci || moveAnalysis.classification === "BEST";
  const verdict = verdictFor(moveAnalysis, playedBest, bestSan);
  const hasLine = pvSteps.length > 0;

  const moveLabel = `${Math.ceil(move.ply / 2)}${move.ply % 2 === 1 ? "." : "…"} ${move.san}`;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <verdict.icon className={cn("mt-0.5 size-4 shrink-0", verdict.tone)} />
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold", verdict.tone)}>{verdict.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{verdict.body}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-card/60 px-3 py-2.5 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Your move</p>
            <p className="font-medium">{moveLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Recommended</p>
            <p className="font-medium">{playedBest ? move.san : (bestSan ?? "—")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Best eval</p>
            <p className="font-mono font-medium">{formatEval(moveAnalysis.evalBeforeCp, moveAnalysis.evalBeforeMate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{playedBest ? "Depth" : "Cost"}</p>
            <p className="font-mono font-medium">
              {playedBest ? moveAnalysis.depth : `−${moveAnalysis.cpLoss} cp`}
            </p>
          </div>
        </div>

        {hasLine && (
          <p className="truncate px-0.5 text-xs text-muted-foreground" title={pvSteps.map((s) => s.san).join(" ")}>
            <span className="font-medium text-foreground/80">Line:</span> {pvSteps.map((s) => s.san).join(" ")}
            <span className="ml-2 text-[10px]">d{moveAnalysis.depth}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!playedBest && hasLine && (
            <Button size="sm" onClick={() => enterVariation(move.ply, [pvSteps[0]!.uci])}>
              <Play /> Play best move
            </Button>
          )}
          {hasLine && (
            <Button
              size="sm"
              variant={playedBest ? "default" : "outline"}
              onClick={() =>
                enterVariation(
                  move.ply,
                  pvSteps.map((s) => s.uci),
                )
              }
            >
              <ListVideo /> Play engine line
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
