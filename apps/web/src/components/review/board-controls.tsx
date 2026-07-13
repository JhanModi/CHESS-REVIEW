"use client";

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FlipVertical2,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReviewStore } from "@/stores/review-store";

function ControlButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function BoardControls() {
  const currentPly = useReviewStore((s) => s.currentPly);
  const totalPlies = useReviewStore((s) => s.game?.moves.length ?? 0);
  const autoplay = useReviewStore((s) => s.autoplay);
  const { first, prev, next, last, flip, setAutoplay } = useReviewStore.getState();

  return (
    <div className="flex items-center justify-center gap-0.5">
      <ControlButton label="Start (Home)" onClick={first} disabled={currentPly === 0}>
        <ChevronFirst />
      </ControlButton>
      <ControlButton label="Previous (←)" onClick={prev} disabled={currentPly === 0}>
        <ChevronLeft />
      </ControlButton>
      <ControlButton
        label={autoplay ? "Pause (space)" : "Autoplay (space)"}
        onClick={() => setAutoplay(!autoplay)}
        disabled={totalPlies === 0}
      >
        {autoplay ? <Pause /> : <Play />}
      </ControlButton>
      <ControlButton label="Next (→)" onClick={next} disabled={currentPly >= totalPlies}>
        <ChevronRight />
      </ControlButton>
      <ControlButton label="End (End)" onClick={last} disabled={currentPly >= totalPlies}>
        <ChevronLast />
      </ControlButton>
      <ControlButton label="Flip board (f)" onClick={flip}>
        <FlipVertical2 />
      </ControlButton>
    </div>
  );
}
