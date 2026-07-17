"use client";

import { useEffect, useMemo } from "react";
import type { GameDetailDto } from "@tempo/types";
import { Board } from "@/components/board/board";
import { EvalBar } from "@/components/board/eval-bar";
import { AnalysisPanel } from "@/components/review/analysis-panel";
import { BestMoveCard } from "@/components/review/best-move-card";
import { BoardControls } from "@/components/review/board-controls";
import { EngineLines } from "@/components/review/engine-lines";
import { EvalGraph } from "@/components/review/eval-graph";
import { GameSummaryPanel } from "@/components/review/game-summary";
import { MoveList } from "@/components/review/move-list";
import { ShareButton } from "@/components/review/share-button";
import { VariationControls } from "@/components/review/variation-controls";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutoplay, useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { parseSquareName } from "@/lib/board/piece-track";
import { currentFen, STANDARD_INITIAL_FEN, useReviewStore } from "@/stores/review-store";

const RESULT_LABEL: Record<string, string> = {
  WHITE_WIN: "1–0",
  BLACK_WIN: "0–1",
  DRAW: "½–½",
  UNKNOWN: "·",
};

function uciEnds(uci: string): { from: number; to: number } {
  return { from: parseSquareName(uci.slice(0, 2)), to: parseSquareName(uci.slice(2, 4)) };
}

/**
 * The full review experience for one game. `readOnly` renders the public
 * share view: no analysis controls, no share management.
 */
export function GameReview({ game, readOnly = false }: { game: GameDetailDto; readOnly?: boolean }) {
  const setGame = useReviewStore((s) => s.setGame);
  const clear = useReviewStore((s) => s.clear);
  const currentPly = useReviewStore((s) => s.currentPly);
  const orientation = useReviewStore((s) => s.orientation);
  const snapshots = useReviewStore((s) => s.snapshots);
  const variation = useReviewStore((s) => s.variation);
  const goTo = useReviewStore((s) => s.goTo);

  useKeyboardNav();
  useAutoplay();

  useEffect(() => {
    setGame(game);
    return () => clear();
  }, [game, setGame, clear]);

  const analysisByPly = useMemo(
    () => new Map((game.analysis?.moves ?? []).map((m) => [m.ply, m])),
    [game.analysis?.moves],
  );

  if (snapshots.length === 0) return null;

  const currentMove = currentPly > 0 ? game.moves[currentPly - 1] : undefined;
  const currentAnalysis = currentPly > 0 ? analysisByPly.get(currentPly) : undefined;
  const nextAnalysis = analysisByPly.get(currentPly + 1);
  const fen = currentFen({ game, currentPly });
  const initialFen = game.initialFen ?? STANDARD_INITIAL_FEN;

  // ── board inputs: engine-variation preview overrides the game position ──
  let snapshot = snapshots[Math.min(currentPly, snapshots.length - 1)]!;
  let lastMove: { from: number; to: number } | null = null;
  let checkSquare: number | null = null;
  let badge: { square: number; classification: NonNullable<typeof currentAnalysis>["classification"] } | null = null;
  let arrow: { from: number; to: number } | null = null;
  const highlightVariant: "game" | "variation" = variation ? "variation" : "game";

  if (variation) {
    snapshot = variation.snapshots[Math.min(variation.cursor, variation.snapshots.length - 1)]!;
    const lastStep = variation.cursor > 0 ? variation.steps[variation.cursor - 1] : undefined;
    lastMove = lastStep ? uciEnds(lastStep.uci) : null;
    if (lastStep && /[+#]/.test(lastStep.san)) {
      const sideToMove = lastStep.fenAfter.split(/\s+/)[1] === "b" ? "b" : "w";
      checkSquare = snapshot.find((p) => p.role === "k" && p.color === sideToMove)?.square ?? null;
    }
    const nextStep = variation.steps[variation.cursor];
    arrow = nextStep ? uciEnds(nextStep.uci) : null;
  } else {
    lastMove = currentMove ? uciEnds(currentMove.uci) : null;
    const inCheck = currentMove ? /[+#]/.test(currentMove.san) : false;
    const sideToMove = currentPly % 2 === 0 ? "w" : "b";
    checkSquare = inCheck
      ? (snapshot.find((p) => p.role === "k" && p.color === sideToMove)?.square ?? null)
      : null;
    badge =
      currentMove && currentAnalysis
        ? { square: uciEnds(currentMove.uci).to, classification: currentAnalysis.classification }
        : null;
    // Show the best move for the move that was just played (retrospective):
    // the engine's best move in the position *before* the current move — i.e.
    // "what the mover should have played" — rather than the opponent's reply.
    arrow =
      currentAnalysis && currentAnalysis.bestMoveUci.length >= 4 && currentAnalysis.bestMoveUci !== "none"
        ? uciEnds(currentAnalysis.bestMoveUci)
        : null;
  }

  // Eval bar: during a preview, hold the studied move's best-play eval —
  // no per-position evals exist inside a stored PV and we never recompute.
  const studiedAnalysis = variation ? analysisByPly.get(variation.returnPly) : undefined;
  const evalScore = variation
    ? studiedAnalysis
      ? studiedAnalysis.evalBeforeMate !== null
        ? { mate: studiedAnalysis.evalBeforeMate }
        : { cp: studiedAnalysis.evalBeforeCp ?? 0 }
      : null
    : nextAnalysis
      ? nextAnalysis.evalBeforeMate !== null
        ? { mate: nextAnalysis.evalBeforeMate }
        : { cp: nextAnalysis.evalBeforeCp ?? 0 }
      : currentAnalysis
        ? currentAnalysis.evalAfterMate !== null
          ? { mate: currentAnalysis.evalAfterMate }
          : { cp: currentAnalysis.evalAfterCp ?? 0 }
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
        {!readOnly && <ShareButton game={game} className="ml-auto" />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <EvalBar score={evalScore} orientation={orientation} className="self-stretch" />
            <div className="min-w-0 flex-1">
              <Board
                snapshot={snapshot}
                orientation={orientation}
                lastMove={lastMove}
                highlightVariant={highlightVariant}
                checkSquare={checkSquare}
                badge={badge}
                arrow={arrow}
              />
            </div>
          </div>
          {variation ? <VariationControls /> : <BoardControls />}
          {game.analysis && game.analysis.moves.length > 0 && (
            <EvalGraph
              moves={game.analysis.moves}
              gameMoves={game.moves}
              totalPlies={game.moves.length}
              currentPly={variation ? variation.returnPly : currentPly}
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
              {!readOnly && <AnalysisPanel game={game} />}
              {game.analysis && !variation && <EngineLines nextMoveAnalysis={nextAnalysis} fen={fen} />}
              {currentMove && currentAnalysis && (
                <BestMoveCard
                  move={currentMove}
                  moveAnalysis={currentAnalysis}
                  fenBefore={currentFen({ game, currentPly: currentPly - 1 })}
                />
              )}
              <MoveList
                moves={game.moves}
                analysis={analysisByPly}
                initialFen={initialFen}
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
                  {readOnly
                    ? "This game hasn't been fully analysed."
                    : "Run the analysis to see accuracy, turning points and the full report."}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
