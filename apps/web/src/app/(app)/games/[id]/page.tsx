"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import type { GameDetailDto } from "@tempo/types";
import { GameReview } from "@/components/review/game-review";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";

export default function GameReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const { data: game, isLoading, error } = useQuery({
    queryKey: ["game", id],
    queryFn: () => api<GameDetailDto>(`/games/${id}`),
  });

  if (isLoading || (!game && !error)) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }
  if (error || !game) {
    return <p className="py-16 text-center text-muted-foreground">Game not found.</p>;
  }
  return <GameReview game={game} />;
}
