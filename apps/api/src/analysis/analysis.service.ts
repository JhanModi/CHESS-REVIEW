import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  classifyMove,
  DEFAULT_THRESHOLDS,
  epdFromFen,
  isBookPosition,
  isSacrifice,
  parseGame,
  summarizeGame,
  type ClassificationThresholds,
  type ClassifiedMove,
  type ParsedGame,
  type Score,
} from "@tempo/chess-core";
import type { Prisma } from "@tempo/db";
import type { AnalysisDto, EvalCacheEntryDto, SubmitAnalysisRequest } from "@tempo/types";
import { toAnalysisDto } from "../games/games.serializer.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { mergeEvalSources } from "./eval-sources.js";

interface CachedLine {
  moveUci: string;
  cp?: number;
  mate?: number;
  pv: string[];
}

function lineScore(line: CachedLine): Score {
  return line.mate !== undefined ? { mate: line.mate } : { cp: line.cp ?? 0 };
}

@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Accepts a batch of raw position evaluations from the client, stores them
   * in the submitting user's own eval store (ADR 008 — client evals are
   * untrusted and never shared across users), then re-derives every derivable
   * per-move record server-side (ADR 007). Batches may arrive incrementally
   * and out of order; lastPly tracks the contiguous frontier for resume.
   */
  async submit(userId: string, gameId: string, dto: SubmitAnalysisRequest): Promise<AnalysisDto> {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, userId },
      select: { id: true, pgn: true, user: { select: { settings: true } } },
    });
    if (!game) throw new NotFoundException("Game not found");

    const parsed = parseGame(game.pgn);
    const totalPlies = parsed.moves.length;
    const epdForIndex = (index: number): string =>
      index === 0 ? epdFromFen(parsed.initialFen) : parsed.moves[index - 1]!.epdAfter;

    for (const position of dto.positions) {
      if (position.index > totalPlies) {
        throw new BadRequestException(`Position index ${position.index} exceeds game length ${totalPlies}`);
      }
    }

    await this.prisma.analysis.upsert({
      where: { gameId },
      create: { gameId, engineId: dto.engineId, targetDepth: dto.targetDepth, status: "PARTIAL" },
      update: { engineId: dto.engineId, targetDepth: dto.targetDepth },
    });

    // Write-through to the user's own eval store, depth-monotonically. Never
    // to the shared EngineEvaluation cache, which holds server evals only.
    for (const position of dto.positions) {
      const epd = epdForIndex(position.index);
      const best = position.lines[0]!;
      const data = {
        engineId: dto.engineId,
        depth: position.depth,
        evalCp: best.cp ?? null,
        evalMate: best.mate ?? null,
        bestMoveUci: best.moveUci,
        pv: best.pv.join(" "),
        multiPv: position.lines as unknown as Prisma.InputJsonValue,
        nodes: position.nodes !== undefined ? BigInt(position.nodes) : null,
      };
      const key = { userId_epd: { userId, epd } };
      const existing = await this.prisma.clientEvaluation.findUnique({ where: key, select: { depth: true } });
      if (!existing) {
        await this.prisma.clientEvaluation.create({ data: { userId, epd, ...data } });
      } else if (existing.depth < position.depth) {
        await this.prisma.clientEvaluation.update({ where: key, data });
      }
    }

    await this.deriveMoves(userId, gameId, parsed, this.thresholds(game.user.settings));
    return this.get(userId, gameId);
  }

  /**
   * The evaluations a user may rely on (ADR 008): their own client-submitted
   * rows plus trusted server rows, deeper winning. Other users' client rows
   * are never visible.
   */
  private async loadEvals(userId: string, epds: readonly string[]) {
    const unique = [...new Set(epds)];
    const [own, trusted] = await Promise.all([
      this.prisma.clientEvaluation.findMany({ where: { userId, epd: { in: unique } } }),
      this.prisma.engineEvaluation.findMany({ where: { epd: { in: unique } } }),
    ]);
    return mergeEvalSources(userId, own, trusted);
  }

  private thresholds(settings: unknown): ClassificationThresholds {
    const overrides =
      settings && typeof settings === "object"
        ? ((settings as Record<string, unknown>).thresholds as Partial<ClassificationThresholds> | undefined)
        : undefined;
    return { ...DEFAULT_THRESHOLDS, ...overrides };
  }

  /** Re-derives MoveAnalysis rows from the evaluations this user may rely on. */
  private async deriveMoves(
    userId: string,
    gameId: string,
    parsed: ParsedGame,
    thresholds: ClassificationThresholds,
  ): Promise<void> {
    const totalPlies = parsed.moves.length;
    const epds = [epdFromFen(parsed.initialFen), ...parsed.moves.map((m) => m.epdAfter)];
    const cache = await this.loadEvals(userId, epds);

    const analysis = await this.prisma.analysis.findUnique({ where: { gameId } });
    if (!analysis) return;

    const classified: ClassifiedMove[] = [];
    let lastContiguous = 0;

    for (let ply = 1; ply <= totalPlies; ply++) {
      const before = cache.get(epds[ply - 1]!);
      const after = cache.get(epds[ply]!);
      if (!before || !after) break;

      const move = parsed.moves[ply - 1]!;
      const beforeLines = (before.multiPv as unknown as CachedLine[] | null) ?? [];
      const bestLine: CachedLine =
        beforeLines[0] ??
        ({ moveUci: before.bestMoveUci, cp: before.evalCp ?? undefined, mate: before.evalMate ?? undefined, pv: before.pv.split(" ").filter(Boolean) } as CachedLine);
      const secondLine = beforeLines[1];
      const afterLines = (after.multiPv as unknown as CachedLine[] | null) ?? [];
      const afterBest: CachedLine =
        afterLines[0] ??
        ({ moveUci: after.bestMoveUci, cp: after.evalCp ?? undefined, mate: after.evalMate ?? undefined, pv: [] } as CachedLine);

      const result = classifyMove(
        {
          ply,
          uci: move.uci,
          evalBefore: lineScore(bestLine),
          bestMoveUci: bestLine.moveUci,
          secondScore: secondLine ? lineScore(secondLine) : undefined,
          evalAfter: lineScore(afterBest),
          legalMovesBefore: move.legalMovesBefore,
          isBook: isBookPosition(move.epdAfter),
          isSacrifice: isSacrifice(move.fenBefore, move.uci),
        },
        thresholds,
      );
      classified.push(result);
      lastContiguous = ply;

      const depth = Math.min(before.depth, after.depth);
      const row = {
        evalBeforeCp: bestLine.cp ?? null,
        evalBeforeMate: bestLine.mate ?? null,
        evalAfterCp: afterBest.cp ?? null,
        evalAfterMate: afterBest.mate ?? null,
        bestMoveUci: bestLine.moveUci,
        bestLinePv: bestLine.pv.join(" "),
        secondMoveUci: secondLine?.moveUci ?? null,
        secondCp: secondLine?.cp ?? null,
        secondMate: secondLine?.mate ?? null,
        depth,
        winBefore: result.winBefore,
        winAfter: result.winAfter,
        cpLoss: result.cpLoss,
        accuracy: result.accuracy,
        classification: result.label.toUpperCase() as Prisma.MoveAnalysisCreateInput["classification"],
      };
      await this.prisma.moveAnalysis.upsert({
        where: { analysisId_ply: { analysisId: analysis.id, ply } },
        create: { analysisId: analysis.id, ply, ...row },
        update: row,
      });
    }

    const complete = lastContiguous === totalPlies && totalPlies > 0;
    let summaryData: Prisma.AnalysisUpdateInput = {
      lastPly: lastContiguous,
      status: complete ? "COMPLETE" : "PARTIAL",
    };
    if (complete) {
      const summary = summarizeGame(parsed.moves, classified);
      summaryData = {
        ...summaryData,
        accuracyWhite: summary.accuracy.white,
        accuracyBlack: summary.accuracy.black,
        acplWhite: summary.acpl.white,
        acplBlack: summary.acpl.black,
        summary: summary as unknown as Prisma.InputJsonValue,
      };
    }
    await this.prisma.analysis.update({ where: { gameId }, data: summaryData });
  }

  async get(userId: string, gameId: string): Promise<AnalysisDto> {
    const analysis = await this.prisma.analysis.findFirst({
      where: { gameId, game: { userId } },
      include: { moves: { orderBy: { ply: "asc" } } },
    });
    if (!analysis) throw new NotFoundException("No analysis for this game");
    return toAnalysisDto(analysis);
  }

  /**
   * Eval-cache lookup so clients can skip already-known positions. Returns
   * only the caller's own evals and trusted server evals (ADR 008).
   */
  async lookup(userId: string, epds: string[]): Promise<EvalCacheEntryDto[]> {
    const rows = [...(await this.loadEvals(userId, epds.slice(0, 200))).values()];
    return rows.map((row) => ({
      epd: row.epd,
      engineId: row.engineId,
      depth: row.depth,
      lines: ((row.multiPv as unknown as CachedLine[] | null) ?? []).map((line) => ({
        moveUci: line.moveUci,
        cp: line.cp,
        mate: line.mate,
        pv: line.pv,
      })),
    }));
  }
}
