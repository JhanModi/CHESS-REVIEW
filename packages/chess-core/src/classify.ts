import { moveAccuracy } from "./accuracy.js";
import {
  colorOfPly,
  DEFAULT_THRESHOLDS,
  type ClassificationThresholds,
  type ClassifiedMove,
  type MoveEvalContext,
  type MoveLabel,
} from "./types.js";
import { povCp, povWinPercent, scoreToCp, winPercentFromScore } from "./winPercent.js";

/**
 * Classifies one played move from its engine evaluations (ADR 004).
 * Label precedence: book → forced → brilliant → great → best → miss →
 * blunder/mistake/inaccuracy → excellent/good.
 */
export function classifyMove(
  ctx: MoveEvalContext,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): ClassifiedMove {
  const color = colorOfPly(ctx.ply);
  const winBefore = povWinPercent(winPercentFromScore(ctx.evalBefore), color);
  const winAfter = povWinPercent(winPercentFromScore(ctx.evalAfter), color);
  const loss = Math.max(0, winBefore - winAfter);
  const cpLoss = Math.max(0, povCp(scoreToCp(ctx.evalBefore), color) - povCp(scoreToCp(ctx.evalAfter), color));
  const accuracy = moveAccuracy(winBefore, winAfter);

  const isBestMove = ctx.uci === ctx.bestMoveUci || winAfter >= winBefore;

  const hadMate = ctx.evalBefore.mate !== undefined && povCp(scoreToCp(ctx.evalBefore), color) > 0;
  const keptMate = ctx.evalAfter.mate !== undefined && povCp(scoreToCp(ctx.evalAfter), color) > 0;

  const label = ((): MoveLabel => {
    if (ctx.isBook) return "book";
    if (ctx.legalMovesBefore <= 1) return "forced";

    if (
      ctx.isSacrifice &&
      loss <= thresholds.brilliantMaxLoss &&
      winAfter >= thresholds.brilliantMinWinAfter &&
      winBefore <= thresholds.brilliantMaxWinBefore
    ) {
      return "brilliant";
    }

    if (isBestMove && ctx.secondScore !== undefined) {
      const secondWin = povWinPercent(winPercentFromScore(ctx.secondScore), color);
      if (winBefore - secondWin >= thresholds.greatGap) return "great";
    }
    if (isBestMove) return "best";

    // Missed forced mate (played a still-winning but mate-losing move).
    if (hadMate && !keptMate && loss >= thresholds.brilliantMaxLoss && winAfter >= thresholds.missWinAfterFloor) {
      return "miss";
    }
    // Missed win: was clearly winning, gave a chunk back, but isn't lost.
    if (
      winBefore >= thresholds.missWinBefore &&
      loss >= thresholds.missMinLoss &&
      winAfter >= thresholds.missWinAfterFloor
    ) {
      return "miss";
    }

    if (loss >= thresholds.blunder) return "blunder";
    if (loss >= thresholds.mistake) return "mistake";
    if (loss >= thresholds.inaccuracy) return "inaccuracy";
    if (loss <= thresholds.excellent) return "excellent";
    return "good";
  })();

  return { ply: ctx.ply, color, label, winBefore, winAfter, cpLoss, accuracy };
}
