"use client";

import { ChevronLeft, ChevronRight, Pause, Play, TelescopeIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReviewStore } from "@/stores/review-store";

/**
 * Replaces the game controls while an engine-line preview is active:
 * banner + pause/resume, step, and exit. The original game position is
 * always one click (or Escape) away.
 */
export function VariationControls() {
  const variation = useReviewStore((s) => s.variation);
  const { variationNext, variationPrev, setVariationPlaying, exitVariation } = useReviewStore.getState();

  if (!variation) return null;
  const atEnd = variation.cursor >= variation.steps.length;
  const sans = variation.steps.map((s, i) => ({ san: s.san, done: i < variation.cursor }));

  return (
    <div className="space-y-2 rounded-lg border border-[var(--board-variation)] bg-card/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[oklch(0.62_0.13_200)] dark:text-[var(--cls-brilliant)]">
          <TelescopeIcon className="size-3.5" />
          Viewing engine variation
        </p>
        <Button variant="ghost" size="sm" onClick={exitVariation}>
          <X className="size-3.5" /> Exit (Esc)
        </Button>
      </div>

      <div className="flex items-center justify-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous variation move"
              onClick={variationPrev}
              disabled={variation.cursor === 0}
            >
              <ChevronLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous (←)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={variation.playing ? "Pause line" : "Resume line"}
              onClick={() => setVariationPlaying(!variation.playing)}
            >
              {variation.playing ? <Pause /> : <Play />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{variation.playing ? "Pause (space)" : atEnd ? "Replay (space)" : "Resume (space)"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next variation move"
              onClick={variationNext}
              disabled={atEnd}
            >
              <ChevronRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next (→)</TooltipContent>
        </Tooltip>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {sans.map((s, i) => (
          <span key={i} className={s.done ? "font-semibold text-foreground" : undefined}>
            {s.san}
            {i < sans.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
