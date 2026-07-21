import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { findOpening, parseGames, PgnParseError, type ParsedGame } from "@tempo/chess-core";
import type { GameSource, GameResult, Prisma } from "@tempo/db";
import type { CreateGamesRequest, ListGamesQuery } from "@tempo/types";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service.js";
import { toDetail, toListItem, type GameFull, type GameWithMeta } from "./games.serializer.js";

const MAX_GAMES_PER_UPLOAD = 100;

const META_INCLUDE = {
  opening: true,
  analysis: { select: { status: true, accuracyWhite: true, accuracyBlack: true } },
} satisfies Prisma.GameInclude;

export interface ExternalGameInput {
  source: GameSource;
  externalId: string;
  pgn: string;
  whiteName: string;
  blackName: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: GameResult;
  timeControl: string | null;
  playedAt: Date | null;
}

function headerResult(result: string | undefined): GameResult {
  switch (result) {
    case "1-0":
      return "WHITE_WIN";
    case "0-1":
      return "BLACK_WIN";
    case "1/2-1/2":
      return "DRAW";
    default:
      return "UNKNOWN";
  }
}

function headerDate(headers: Record<string, string>): Date | null {
  const date = headers.UTCDate ?? headers.Date;
  if (!date || date.includes("?")) return null;
  const time = headers.UTCTime ?? "12:00:00";
  const parsed = new Date(`${date.replaceAll(".", "-")}T${time}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function headerElo(value: string | undefined): number | null {
  const elo = Number(value);
  return Number.isInteger(elo) && elo > 0 ? elo : null;
}

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parses and stores every game in a (possibly multi-game) PGN payload. */
  async createFromPgn(userId: string, dto: CreateGamesRequest): Promise<{ ids: string[]; count: number }> {
    let parsed: ParsedGame[];
    try {
      parsed = parseGames(dto.pgn);
    } catch (err) {
      if (err instanceof PgnParseError) throw new BadRequestException(err.message);
      throw err;
    }
    const playable = parsed.filter((g) => g.moves.length > 0);
    if (playable.length === 0) throw new BadRequestException("No playable games found in PGN");
    if (playable.length > MAX_GAMES_PER_UPLOAD) {
      throw new BadRequestException(`At most ${MAX_GAMES_PER_UPLOAD} games per upload`);
    }

    const ids: string[] = [];
    for (const game of playable) {
      const created = await this.persistParsedGame(userId, game, {
        source: dto.source,
        // Single-game payloads keep the user's exact PGN (variations,
        // comments); multi-game files are re-serialised per game.
        pgn: playable.length === 1 ? dto.pgn : null,
        externalId: null,
        userColor: null,
        overrides: null,
      });
      ids.push(created);
    }
    return { ids, count: ids.length };
  }

  /**
   * Stores one game fetched from an external platform. Returns null when the
   * game already exists (idempotent sync) or the PGN cannot be replayed.
   */
  async createFromImport(userId: string, input: ExternalGameInput, username: string): Promise<string | null> {
    const existing = await this.prisma.game.findUnique({
      where: {
        userId_source_externalId: { userId, source: input.source, externalId: input.externalId },
      },
      select: { id: true },
    });
    if (existing) return null;

    let parsed: ParsedGame;
    try {
      const games = parseGames(input.pgn);
      if (!games[0] || games[0].moves.length === 0) return null;
      parsed = games[0];
    } catch {
      return null;
    }

    const lowered = username.toLowerCase();
    const userColor =
      input.whiteName.toLowerCase() === lowered
        ? ("WHITE" as const)
        : input.blackName.toLowerCase() === lowered
          ? ("BLACK" as const)
          : null;

    return this.persistParsedGame(userId, parsed, {
      source: input.source,
      pgn: input.pgn,
      externalId: input.externalId,
      userColor,
      overrides: input,
    });
  }

  private async persistParsedGame(
    userId: string,
    game: ParsedGame,
    options: {
      source: GameSource;
      pgn: string | null;
      externalId: string | null;
      userColor: "WHITE" | "BLACK" | null;
      overrides: ExternalGameInput | null;
    },
  ): Promise<string> {
    const openingMatch = findOpening(game.moves);
    const opening = openingMatch
      ? await this.prisma.opening.findUnique({ where: { epd: openingMatch.opening.epd }, select: { id: true, eco: true } })
      : null;

    const o = options.overrides;
    const created = await this.prisma.game.create({
      data: {
        userId,
        source: options.source,
        externalId: options.externalId,
        pgn: options.pgn ?? rebuildPgnSource(game),
        whiteName: o?.whiteName ?? game.headers.White ?? "White",
        blackName: o?.blackName ?? game.headers.Black ?? "Black",
        whiteElo: o?.whiteElo ?? headerElo(game.headers.WhiteElo),
        blackElo: o?.blackElo ?? headerElo(game.headers.BlackElo),
        userColor: options.userColor,
        result: o?.result ?? headerResult(game.headers.Result),
        timeControl: o?.timeControl ?? game.headers.TimeControl ?? null,
        eco: opening?.eco ?? game.headers.ECO ?? null,
        openingId: opening?.id ?? null,
        playedAt: o?.playedAt ?? headerDate(game.headers),
        moves: {
          createMany: {
            data: game.moves.map((m) => ({
              ply: m.ply,
              san: m.san,
              uci: m.uci,
              fenAfter: m.fenAfter,
              epdAfter: m.epdAfter,
              clockSeconds: m.clockSeconds ?? null,
            })),
          },
        },
      },
      select: { id: true },
    });
    return created.id;
  }

  async list(
    userId: string,
    query: ListGamesQuery,
  ): Promise<{ items: ReturnType<typeof toListItem>[]; nextCursor: string | null }> {
    const games = await this.prisma.game.findMany({
      where: {
        userId,
        source: query.source,
        result: query.result,
        analysis: query.analysed === undefined ? undefined : query.analysed ? { isNot: null } : { is: null },
      },
      include: META_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = games.length > query.limit;
    const page = hasMore ? games.slice(0, query.limit) : games;
    return {
      items: page.map((g) => toListItem(g as GameWithMeta)),
      nextCursor: hasMore ? page.at(-1)!.id : null,
    };
  }

  async getDetail(userId: string, gameId: string): Promise<ReturnType<typeof toDetail>> {
    const game = await this.loadFull({ id: gameId, userId });
    return toDetail(game, game.headersInitialFen);
  }

  async getSharedDetail(slug: string): Promise<ReturnType<typeof toDetail>> {
    const game = await this.loadFull({ shareSlug: slug });
    return toDetail(game, game.headersInitialFen);
  }

  private async loadFull(where: Prisma.GameWhereInput): Promise<GameFull & { headersInitialFen: string | null }> {
    const game = await this.prisma.game.findFirst({
      where,
      include: {
        opening: true,
        moves: { orderBy: { ply: "asc" } },
        analysis: { include: { moves: { orderBy: { ply: "asc" } } } },
      },
    });
    if (!game) throw new NotFoundException("Game not found");
    const fenHeader = /\[FEN\s+"([^"]+)"\]/.exec(game.pgn);
    return Object.assign(game, { headersInitialFen: fenHeader?.[1] ?? null });
  }

  async delete(userId: string, gameId: string): Promise<void> {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, userId }, select: { id: true } });
    if (!game) throw new NotFoundException("Game not found");
    await this.prisma.game.delete({ where: { id: gameId } });
  }

  /**
   * Deletes every game owned by the user (and, via cascade, their moves and
   * analysis). Scoped strictly to `userId`, so one account can never clear
   * another's data. Returns how many games were removed.
   */
  async deleteAll(userId: string): Promise<{ deleted: number }> {
    const { count } = await this.prisma.game.deleteMany({ where: { userId } });
    return { deleted: count };
  }

  async share(userId: string, gameId: string): Promise<{ shareSlug: string }> {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, userId }, select: { id: true, shareSlug: true } });
    if (!game) throw new NotFoundException("Game not found");
    if (game.shareSlug) return { shareSlug: game.shareSlug };
    const shareSlug = nanoid(10);
    await this.prisma.game.update({ where: { id: gameId }, data: { shareSlug } });
    return { shareSlug };
  }

  async unshare(userId: string, gameId: string): Promise<void> {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, userId }, select: { id: true } });
    if (!game) throw new NotFoundException("Game not found");
    await this.prisma.game.update({ where: { id: gameId }, data: { shareSlug: null } });
  }
}

/** For pasted movetext without headers, store a normalised PGN. */
function rebuildPgnSource(game: ParsedGame): string {
  const headerLines = Object.entries(game.headers)
    .map(([key, value]) => `[${key} "${value}"]`)
    .join("\n");
  const sans = game.moves
    .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san))
    .join(" ");
  const result = game.headers.Result ?? "*";
  return `${headerLines}\n\n${sans} ${result}\n`;
}
