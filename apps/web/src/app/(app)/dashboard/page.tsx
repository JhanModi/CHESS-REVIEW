"use client";

import { useQuery } from "@tanstack/react-query";
import { Gauge, Percent, Swords, Target } from "lucide-react";
import Link from "next/link";
import type { DashboardStatsDto, GameListItemDto } from "@tempo/types";
import { AccuracyTrend } from "@/components/dashboard/accuracy-trend";
import { LabelDistribution } from "@/components/dashboard/label-distribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const RESULT_LABEL: Record<string, string> = {
  WHITE_WIN: "1–0",
  BLACK_WIN: "0–1",
  DRAW: "½–½",
  UNKNOWN: "·",
};

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </div>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function resultTone(game: GameListItemDto): string {
  if (!game.userColor || game.result === "UNKNOWN" || game.result === "DRAW")
    return "text-muted-foreground";
  const won = (game.result === "WHITE_WIN") === (game.userColor === "WHITE");
  return won ? "text-[var(--cls-best)]" : "text-[var(--cls-blunder)]";
}

export default function DashboardPage() {
  const api = useApi();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardStatsDto>("/stats/dashboard"),
  });

  if (isLoading || !stats) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (stats.totalGames === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
            <Swords className="size-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Welcome to Tempo</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Import your games from Lichess, Chess.com or a PGN file, then run Stockfish analysis
              to see your accuracy, mistakes and trends here.
            </p>
            <Button asChild size="lg" className="mt-2">
              <Link href="/import">Import your first games</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const wr = stats.winRate;
  const winPct =
    wr && wr.wins + wr.losses + wr.draws > 0
      ? ((wr.wins + wr.draws * 0.5) / (wr.wins + wr.losses + wr.draws)) * 100
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Swords}
          label="Games"
          value={String(stats.totalGames)}
          hint={`${stats.analysedGames} analysed`}
        />
        <StatTile
          icon={Percent}
          label="Score"
          value={winPct !== null ? `${winPct.toFixed(0)}%` : "—"}
          hint={wr ? `${wr.wins}W · ${wr.draws}D · ${wr.losses}L` : "no rated results yet"}
        />
        <StatTile
          icon={Target}
          label="Avg accuracy"
          value={stats.averageAccuracy !== null ? `${stats.averageAccuracy.toFixed(1)}%` : "—"}
          hint="across analysed games"
        />
        <StatTile
          icon={Gauge}
          label="Avg CP loss"
          value={stats.averageAcpl !== null ? String(stats.averageAcpl) : "—"}
          hint="lower is better"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Accuracy over time</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyTrend trend={stats.accuracyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Your move quality</CardTitle>
          </CardHeader>
          <CardContent>
            <LabelDistribution distribution={stats.labelDistribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top openings</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topOpenings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No openings yet.</p>
            ) : (
              <div className="space-y-1">
                {stats.topOpenings.map((o) => (
                  <div key={`${o.eco}-${o.name}`} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="w-11 justify-center font-mono">
                      {o.eco}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{o.games} games</span>
                    <span className="w-12 text-right text-xs font-medium tabular-nums">
                      {(o.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.recentGames.slice(0, 6).map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className={cn("w-7 text-center font-mono text-xs font-bold", resultTone(game))}>
                  {RESULT_LABEL[game.result]}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {game.whiteName} vs {game.blackName}
                </span>
                {game.userAccuracy !== null && (
                  <span className="text-xs font-medium tabular-nums">{game.userAccuracy.toFixed(1)}%</span>
                )}
              </Link>
            ))}
            <div className="pt-1">
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link href="/games">All games →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
