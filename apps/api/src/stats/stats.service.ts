import { Injectable } from "@nestjs/common";
import { Prisma } from "@tempo/db";
import type { DashboardStatsDto, MoveClassification } from "@tempo/types";
import { toListItem, type GameWithMeta } from "../games/games.serializer.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string): Promise<DashboardStatsDto> {
    const [totalGames, analysedGames, resultRows, analyses, labelRows, openingRows, recent] = await Promise.all([
      this.prisma.game.count({ where: { userId } }),
      this.prisma.analysis.count({ where: { game: { userId }, status: "COMPLETE" } }),
      this.prisma.game.groupBy({
        by: ["userColor", "result"],
        where: { userId, userColor: { not: null } },
        _count: true,
      }),
      this.prisma.analysis.findMany({
        where: { game: { userId }, status: "COMPLETE" },
        select: {
          accuracyWhite: true,
          accuracyBlack: true,
          acplWhite: true,
          acplBlack: true,
          game: { select: { id: true, userColor: true, playedAt: true, createdAt: true } },
        },
        orderBy: { game: { createdAt: "desc" } },
        take: 50,
      }),
      this.labelDistribution(userId),
      this.prisma.game.findMany({
        where: { userId, openingId: { not: null } },
        select: { result: true, userColor: true, opening: { select: { eco: true, name: true } } },
      }),
      this.prisma.game.findMany({
        where: { userId },
        include: {
          opening: true,
          analysis: { select: { status: true, accuracyWhite: true, accuracyBlack: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    ]);

    // Win rate from the user's perspective.
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const row of resultRows) {
      const count = row._count;
      if (row.result === "DRAW") draws += count;
      else if (row.result === "WHITE_WIN") row.userColor === "WHITE" ? (wins += count) : (losses += count);
      else if (row.result === "BLACK_WIN") row.userColor === "BLACK" ? (wins += count) : (losses += count);
    }
    const hasResults = wins + losses + draws > 0;

    // Accuracy/ACPL from the user's side when known, else both sides' mean.
    const accuracies: number[] = [];
    const acpls: number[] = [];
    const trend: DashboardStatsDto["accuracyTrend"] = [];
    for (const a of analyses) {
      const side = a.game.userColor;
      const accuracy =
        side === "WHITE" ? a.accuracyWhite : side === "BLACK" ? a.accuracyBlack : mean(a.accuracyWhite, a.accuracyBlack);
      const acpl = side === "WHITE" ? a.acplWhite : side === "BLACK" ? a.acplBlack : mean(a.acplWhite, a.acplBlack);
      if (accuracy !== null) {
        accuracies.push(accuracy);
        trend.push({
          gameId: a.game.id,
          playedAt: (a.game.playedAt ?? a.game.createdAt).toISOString(),
          accuracy: Math.round(accuracy * 10) / 10,
        });
      }
      if (acpl !== null) acpls.push(acpl);
    }
    trend.reverse(); // oldest → newest for charting

    // Top openings by games played, scored from the user's perspective.
    const openingAgg = new Map<string, { eco: string; name: string; games: number; points: number; scored: number }>();
    for (const game of openingRows) {
      if (!game.opening) continue;
      const key = `${game.opening.eco}|${game.opening.name}`;
      const entry = openingAgg.get(key) ?? { eco: game.opening.eco, name: game.opening.name, games: 0, points: 0, scored: 0 };
      entry.games++;
      if (game.userColor && game.result !== "UNKNOWN") {
        entry.scored++;
        if (game.result === "DRAW") entry.points += 0.5;
        else if ((game.result === "WHITE_WIN") === (game.userColor === "WHITE")) entry.points += 1;
      }
      openingAgg.set(key, entry);
    }
    const topOpenings = [...openingAgg.values()]
      .sort((a, b) => b.games - a.games)
      .slice(0, 5)
      .map((o) => ({ eco: o.eco, name: o.name, games: o.games, score: o.scored > 0 ? o.points / o.scored : 0.5 }));

    return {
      totalGames,
      analysedGames,
      winRate: hasResults ? { wins, losses, draws } : null,
      averageAccuracy: accuracies.length > 0 ? round1(avg(accuracies)) : null,
      averageAcpl: acpls.length > 0 ? Math.round(avg(acpls)) : null,
      accuracyTrend: trend.slice(-20),
      labelDistribution: labelRows,
      topOpenings,
      recentGames: recent.map((g) => toListItem(g as GameWithMeta)),
    };
  }

  /** Classification counts for the user's own moves only. */
  private async labelDistribution(userId: string): Promise<Partial<Record<MoveClassification, number>>> {
    const rows = await this.prisma.$queryRaw<Array<{ classification: MoveClassification; count: bigint }>>(
      Prisma.sql`
        SELECT ma."classification", COUNT(*)::bigint AS count
        FROM "MoveAnalysis" ma
        JOIN "Analysis" a ON a."id" = ma."analysisId"
        JOIN "Game" g ON g."id" = a."gameId"
        WHERE g."userId" = ${userId}
          AND (
            g."userColor" IS NULL
            OR (g."userColor" = 'WHITE' AND ma."ply" % 2 = 1)
            OR (g."userColor" = 'BLACK' AND ma."ply" % 2 = 0)
          )
        GROUP BY ma."classification"
      `,
    );
    const distribution: Partial<Record<MoveClassification, number>> = {};
    for (const row of rows) distribution[row.classification] = Number(row.count);
    return distribution;
  }
}

function mean(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return (a + b) / 2;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
