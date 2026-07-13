import type { Analysis, Game, Move, MoveAnalysis, Opening } from "@tempo/db";
import type { AnalysisDto, GameDetailDto, GameListItemDto, MoveAnalysisDto, MoveDto } from "@tempo/types";

export type GameWithMeta = Game & {
  opening: Opening | null;
  analysis: Pick<Analysis, "status" | "accuracyWhite" | "accuracyBlack"> | null;
};

export type GameFull = Game & {
  opening: Opening | null;
  moves: Move[];
  analysis: (Analysis & { moves: MoveAnalysis[] }) | null;
};

function userAccuracy(game: GameWithMeta): number | null {
  if (!game.analysis) return null;
  if (game.userColor === "WHITE") return game.analysis.accuracyWhite;
  if (game.userColor === "BLACK") return game.analysis.accuracyBlack;
  return null;
}

export function toListItem(game: GameWithMeta): GameListItemDto {
  return {
    id: game.id,
    source: game.source,
    whiteName: game.whiteName,
    blackName: game.blackName,
    whiteElo: game.whiteElo,
    blackElo: game.blackElo,
    userColor: game.userColor,
    result: game.result,
    timeControl: game.timeControl,
    eco: game.eco,
    openingName: game.opening?.name ?? null,
    playedAt: game.playedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    analysisStatus: game.analysis?.status ?? null,
    userAccuracy: userAccuracy(game),
  };
}

export function toMoveDto(move: Move): MoveDto {
  return {
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    fenAfter: move.fenAfter,
    epdAfter: move.epdAfter,
    clockSeconds: move.clockSeconds,
  };
}

export function toMoveAnalysisDto(ma: MoveAnalysis): MoveAnalysisDto {
  return {
    ply: ma.ply,
    evalBeforeCp: ma.evalBeforeCp,
    evalBeforeMate: ma.evalBeforeMate,
    evalAfterCp: ma.evalAfterCp,
    evalAfterMate: ma.evalAfterMate,
    bestMoveUci: ma.bestMoveUci,
    bestLinePv: ma.bestLinePv,
    secondMoveUci: ma.secondMoveUci,
    secondCp: ma.secondCp,
    secondMate: ma.secondMate,
    depth: ma.depth,
    winBefore: ma.winBefore,
    winAfter: ma.winAfter,
    cpLoss: ma.cpLoss,
    accuracy: ma.accuracy,
    classification: ma.classification,
  };
}

export function toAnalysisDto(analysis: Analysis & { moves: MoveAnalysis[] }): AnalysisDto {
  return {
    status: analysis.status,
    engineId: analysis.engineId,
    targetDepth: analysis.targetDepth,
    lastPly: analysis.lastPly,
    accuracyWhite: analysis.accuracyWhite,
    accuracyBlack: analysis.accuracyBlack,
    acplWhite: analysis.acplWhite,
    acplBlack: analysis.acplBlack,
    summary: (analysis.summary as Record<string, unknown> | null) ?? null,
    moves: [...analysis.moves].sort((a, b) => a.ply - b.ply).map(toMoveAnalysisDto),
  };
}

export function toDetail(game: GameFull, initialFen: string | null): GameDetailDto {
  return {
    ...toListItem(game),
    pgn: game.pgn,
    initialFen,
    shareSlug: game.shareSlug,
    moves: [...game.moves].sort((a, b) => a.ply - b.ply).map(toMoveDto),
    analysis: game.analysis ? toAnalysisDto(game.analysis) : null,
  };
}
