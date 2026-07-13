"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import type { GameDetailDto } from "@tempo/types";
import { TempoLogo } from "@/components/logo";
import { GameReview } from "@/components/review/game-review";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

export default function SharedGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: game, isLoading } = useQuery({
    queryKey: ["shared-game", slug],
    queryFn: () => apiFetch<GameDetailDto>(`/share/${slug}`),
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/">
          <TempoLogo />
        </Link>
        <Button size="sm" asChild>
          <Link href="/sign-in">Analyse your own games</Link>
        </Button>
      </header>
      <main className="px-4 pb-10 md:px-6">
        {isLoading ? (
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        ) : !game ? (
          <p className="py-16 text-center text-muted-foreground">
            This share link doesn&apos;t exist or has been revoked.
          </p>
        ) : (
          <GameReview game={game} readOnly />
        )}
      </main>
    </div>
  );
}
