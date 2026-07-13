"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useEffect, useMemo } from "react";
import type { GameDetailDto } from "@tempo/types";
import { Board } from "@/components/board/board";
import { EvalBar } from "@/components/board/eval-bar";
import { BoardControls } from "@/components/review/board-controls";
import { EngineLines } from "@/components/review/engine-lines";
import { EvalGraph } from "@/components/review/eval-graph";
import { GameSummaryPanel } from "@/components/review/game-summary";
import { MoveList } from "@/components/review/move-list";
import { AnalysisPanel } from "@/components/review/analysis-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutoplay, useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { parseSquareName } from "@/lib/board/piece-track";
import { useApi } from "@/lib/use-api";
import { currentFen, useReviewStore } from "@/stores/review-store";

const RESULT_LABEL: Record<string, string> = {
  WHITE_WIN: "1–0",
  BLACK_WIN: "0–1",
  DRAW: "½–½",
  UNKNOWN: "·",
};

export default function GameReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const { data: game, isLoading } = useQuery({
    queryKey: ["game", id],
    queryFn: () => api<GameDetailDto>(`/games/${id}`),
  });

  const setGame = useReviewStore((s) => s.setGame);
  const clear = useReviewStore((s) => s.clear);
  const currentPly = useReviewStore((s) => s.currentPly);
  const orientation = useReviewStore((s) => s.orientation);
  const snapshots = useReviewStore((s) => s.snapshots);
  const goTo = useReviewStore((s) => s.goTo);

  useKeyboardNav();
  useAutoplay();

  useEffect(() => {
    if (game) setGame(game);
    return () => clear();
  }, [game, setGame, clear]);

  const analysisByPly = useMemo(
    () => new Map((game?.analysis?.moves ?? []).map((m) => [m.ply, m])),
    [game?.analysis?.moves],
  );

  if (isLoading || !game || snapshots.length === 0) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const snapshot = snapshots[Math.min(currentPly, snapshots.length - 1)]!;
  const currentMove = currentPly > 0 ? game.moves[currentPly - 1] : undefined;
  const currentAnalysis = currentPly > 0 ? analysisByPly.get(currentPly) : undefined;
  const nextAnalysis = analysisByPly.get(currentPly + 1);
  const fen = currentFen({ game, currentPly });

  const lastMove = currentMove
    ? { from: parseSquareName(currentMove.uci.slice(0, 2)), to: parseSquareName(currentMove.uci.slice(2, 4)) }
    : null;
  const inCheck = currentMove ? /[+#]/.test(currentMove.san) : false;
  const sideToMove = currentPly % 2 === 0 ? "w" : "b";
  const checkSquare = inCheck
    ? (snapshot.find((p) => p.role === "k" && p.color === sideToMove)?.square ?? null)
    : null;
  const badge =
    currentMove && currentAnalysis
      ? { square: parseSquareName(currentMove.uci.slice(2, 4)), classification: currentAnalysis.classification }
      : null;
  const arrow =
    nextAnalysis && nextAnalysis.bestMoveUci.length >= 4
      ? {
          from: parseSquareName(nextAnalysis.bestMoveUci.slice(0, 2)),
          to: parseSquareName(nextAnalysis.bestMoveUci.slice(2, 4)),
        }
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold">
          {game.whiteName}
          {game.whiteElo ? ` (${game.whiteElo})` : ""} <span className="text-muted-foreground">vs</span>{" "}
          {game.blackName}
          {game.blackElo ? ` (${game.blackElo})` : ""}
        </h1>
        <Badge variant="secondary">{RESULT_LABEL[game.result]}</Badge>
        {game.openingName && (
          <span className="text-sm text-muted-foreground">
            {game.eco} · {game.openingName}
          </span>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <EvalBar
              score={
                nextAnalysis
                  ? nextAnalysis.evalBeforeMate !== null
                    ? { mate: nextAnalysis.evalBeforeMate }
                    : { cp: nextAnalysis.evalBeforeCp ?? 0 }
                  : currentAnalysis
                    ? currentAnalysis.evalAfterMate !== null
                      ? { mate: currentAnalysis.evalAfterMate }
                      : { cp: currentAnalysis.evalAfterCp ?? 0 }
                    : null
              }
              orientation={orientation}
              className="self-stretch"
            />
            <div className="min-w-0 flex-1">
              <Board
                snapshot={snapshot}
                orientation={orientation}
                lastMove={lastMove}
                checkSquare={checkSquare}
                badge={badge}
                arrow={arrow}
              />
            </div>
          </div>
          <BoardControls />
          {game.analysis && game.analysis.moves.length > 0 && (
            <EvalGraph
              moves={game.analysis.moves}
              gameMoves={game.moves}
              totalPlies={game.moves.length}
              currentPly={currentPly}
              onSelect={goTo}
            />
          )}
        </div>

        <div className="min-h-0">
          <Tabs defaultValue="moves" className="flex h-full flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="moves" className="flex-1">
                Moves
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex-1">
                Summary
              </TabsTrigger>
            </TabsList>
            <TabsContent value="moves" className="min-h-0 flex-1 space-y-3">
              <AnalysisPanel game={game} />
              {game.analysis && <EngineLines nextMoveAnalysis={nextAnalysis} fen={fen} />}
              <MoveList
                moves={game.moves}
                analysis={analysisByPly}
                currentPly={currentPly}
                onSelect={goTo}
                className="max-h-[50dvh] lg:max-h-[calc(100dvh-22rem)]"
              />
            </TabsContent>
            <TabsContent value="summary">
              {game.analysis?.status === "COMPLETE" ? (
                <GameSummaryPanel
                  analysis={game.analysis}
                  moves={game.moves}
                  whiteName={game.whiteName}
                  blackName={game.blackName}
                  onSelect={goTo}
                />
              ) : (
                <p className="px-1 py-4 text-sm text-muted-foreground">
                  Run the analysis to see accuracy, turning points and the full report.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
