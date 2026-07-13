"use client";

import { Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Subtle "engine preferred X" hint on a move-list row. */
export function BestMoveBadge({ bestSan }: { bestSan: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <Lightbulb className="size-3 text-[var(--signal)]" />
          {bestSan}
        </span>
      </TooltipTrigger>
      <TooltipContent>Engine preferred {bestSan}</TooltipContent>
    </Tooltip>
  );
}
