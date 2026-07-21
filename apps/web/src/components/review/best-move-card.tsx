"use client";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  Flame,
  ListVideo,
  Play,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { useMemo } from "react";
import type { MoveAnalysisDto, MoveClassification, MoveDto } from "@tempo/types";
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

function clsTone(c: MoveClassification): string {
  return `text-[var(${CLASSIFICATION_META[c].varName})]`;
}

interface Verdict {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  body: string;
  /** True only for moves worth correcting — drives the "cost"/"play best" UI. */
  corrective: boolean;
}

/**
 * Coaching copy for the selected move. The voice is a teacher, not the engine:
 * theory and good moves are reassured (never framed as a "cost"), and only
 * genuinely worse moves point at an alternative. Copy stays honest — a passive
 * book line still admits the main lines keep a touch more.
 */
function verdictFor(
  ma: MoveAnalysisDto,
  playedBest: boolean,
  bestSan: string | null,
  openingName: string | null,
): Verdict {
  const bestEval = formatEval(ma.evalBeforeCp, ma.evalBeforeMate);
  const playedEval = formatEval(ma.evalAfterCp, ma.evalAfterMate);
  const better = bestSan ?? ma.bestMoveUci;

  if (ma.classification === "BOOK") {
    const passive = ma.cpLoss >= 30;
    return {
      icon: BookOpen,
      tone: "text-muted-foreground",
      corrective: false,
      title: openingName ? `Book — ${openingName}` : "Book move",
      body:
        passive && bestSan
          ? `Established opening theory. The main lines (like ${better}) keep a touch more, but this is a respected, fully playable choice.`
          : "A well-known move from established opening theory — a sound, standard choice here.",
    };
  }

  if (ma.classification === "FORCED") {
    return {
      icon: ArrowRight,
      tone: "text-muted-foreground",
      corrective: false,
      title: "Forced",
      body: "The only legal move — there's nothing to decide in this position.",
    };
  }

  if (ma.classification === "BRILLIANT") {
    return {
      icon: Flame,
      tone: clsTone("BRILLIANT"),
      corrective: false,
      title: "Brilliant!",
      body: "You found the engine's top choice — a sacrifice that works. Play the line to see why it holds.",
    };
  }

  if (ma.classification === "GREAT") {
    return {
      icon: Sparkles,
      tone: clsTone("GREAT"),
      corrective: false,
      title: "Great move",
      body: "The strongest continuation here — and just about the only one that keeps your edge.",
    };
  }

  if (playedBest) {
    return {
      icon: Check,
      tone: clsTone("BEST"),
      corrective: false,
      title: "Best move",
      body: "You played the engine's top move. Follow the line to see the plan behind it.",
    };
  }

  if (ma.classification === "EXCELLENT") {
    return {
      icon: Check,
      tone: clsTone("EXCELLENT"),
      corrective: false,
      title: "Excellent",
      body: "A strong, accurate move that keeps your position on track.",
    };
  }

  if (ma.classification === "GOOD") {
    return {
      icon: ThumbsUp,
      tone: clsTone("GOOD"),
      corrective: false,
      title: "Good move",
      body: bestSan
        ? `A solid, playable move. ${better} was a touch more precise, but the difference is small.`
        : "A solid move that keeps the position sound.",
    };
  }

  if (ma.classification === "INACCURACY") {
    return {
      icon: AlertCircle,
      tone: clsTone("INACCURACY"),
      corrective: true,
      title: "Slight inaccuracy",
      body: `${better} was more accurate here — it keeps ${bestEval} instead of ${playedEval}.`,
    };
  }

  if (ma.classification === "MISS") {
    return {
      icon: X,
      tone: clsTone("MISS"),
      corrective: true,
      title: "Missed chance",
      body: `You had a stronger option in ${better}. Play the line to see what it wins.`,
    };
  }

  if (ma.classification === "MISTAKE") {
    return {
      icon: X,
      tone: clsTone("MISTAKE"),
      corrective: true,
      title: "Mistake",
      body: `${better} was clearly stronger — the position slips from ${bestEval} to ${playedEval}.`,
    };
  }

  if (ma.classification === "BLUNDER") {
    return {
      icon: X,
      tone: clsTone("BLUNDER"),
      corrective: true,
      title: "Blunder",
      body: `${better} was much better. This hands your opponent a real chance — play the engine line to see the punishment.`,
    };
  }

  return {
    icon: Sparkles,
    tone: "text-muted-foreground",
    corrective: false,
    title: bestSan ? `Engine likes ${better}` : "Reasonable move",
    body: `${bestEval} vs ${playedEval}.`,
  };
}

/**
 * The learning card for the selected move. Reads only stored analysis — never
 * triggers engine or network work. Coaching tone; playback of the stored line.
 */
export function BestMoveCard({
  move,
  moveAnalysis,
  fenBefore,
  openingName = null,
}: {
  move: MoveDto;
  moveAnalysis: MoveAnalysisDto;
  fenBefore: string;
  openingName?: string | null;
}) {
  const enterVariation = useReviewStore((s) => s.enterVariation);

  const pv = useMemo(() => moveAnalysis.bestLinePv.split(" ").filter(Boolean), [moveAnalysis.bestLinePv]);
  const pvSteps = useMemo(() => replayLine(fenBefore, pv), [fenBefore, pv]);
  const bestSan = pvSteps[0]?.san ?? null;
  const playedBest = moveAnalysis.bestMoveUci === move.uci || moveAnalysis.classification === "BEST";
  const verdict = verdictFor(moveAnalysis, playedBest, bestSan, openingName);
  const isBook = moveAnalysis.classification === "BOOK";
  const hasLine = pvSteps.length > 0;
  // Theory gets no "play the better move" prompt — no judgement, per design.
  const showEngineLine = hasLine && !isBook;

  const moveLabel = `${Math.ceil(move.ply / 2)}${move.ply % 2 === 1 ? "." : "…"} ${move.san}`;
  const bestEval = formatEval(moveAnalysis.evalBeforeCp, moveAnalysis.evalBeforeMate);
  const playedEval = formatEval(moveAnalysis.evalAfterCp, moveAnalysis.evalAfterMate);

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

        <div
          className={cn(
            "grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-card/60 px-3 py-2.5 text-xs",
            verdict.corrective ? "sm:grid-cols-4" : "sm:grid-cols-3",
          )}
        >
          <div>
            <p className="text-muted-foreground">Your move</p>
            <p className="font-medium">{moveLabel}</p>
          </div>
          {verdict.corrective ? (
            <>
              <div>
                <p className="text-muted-foreground">Better</p>
                <p className="font-medium">{bestSan ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Best eval</p>
                <p className="font-mono font-medium">{bestEval}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost</p>
                <p className="font-mono font-medium">−{moveAnalysis.cpLoss} cp</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground">Eval</p>
                <p className="font-mono font-medium">{playedEval}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Depth</p>
                <p className="font-mono font-medium">{moveAnalysis.depth}</p>
              </div>
            </>
          )}
        </div>

        {showEngineLine && (
          <p className="truncate px-0.5 text-xs text-muted-foreground" title={pvSteps.map((s) => s.san).join(" ")}>
            <span className="font-medium text-foreground/80">Line:</span> {pvSteps.map((s) => s.san).join(" ")}
            <span className="ml-2 text-[10px]">d{moveAnalysis.depth}</span>
          </p>
        )}

        {showEngineLine && (
          <div className="flex flex-wrap gap-2">
            {verdict.corrective && (
              <Button size="sm" onClick={() => enterVariation(move.ply, [pvSteps[0]!.uci])}>
                <Play /> Play best move
              </Button>
            )}
            <Button
              size="sm"
              variant={verdict.corrective ? "outline" : "default"}
              onClick={() =>
                enterVariation(
                  move.ply,
                  pvSteps.map((s) => s.uci),
                )
              }
            >
              <ListVideo /> Play engine line
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
