import { Injectable, Logger } from "@nestjs/common";
import type { GameResult } from "@tempo/db";

/** A game as fetched from an external platform, normalised. */
export interface ExternalGame {
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

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "rate_limited" | "upstream",
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

/** lichess.org public game export — keyless, NDJSON. ~20 games/s anonymous. */
@Injectable()
export class LichessClient {
  async fetchRecentGames(username: string, max: number): Promise<ExternalGame[]> {
    const url =
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
      `?max=${max}&pgnInJson=true&clocks=true&sort=dateDesc`;
    const res = await fetch(url, { headers: { Accept: "application/x-ndjson" } });
    if (res.status === 404) throw new PlatformError(`Lichess user "${username}" not found`, "not_found");
    if (res.status === 429) throw new PlatformError("Lichess rate limit hit — try again in a minute", "rate_limited");
    if (!res.ok) throw new PlatformError(`Lichess responded ${res.status}`, "upstream");

    const text = await res.text();
    const games: ExternalGame[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const raw = JSON.parse(line) as LichessGame;
      if (raw.variant !== "standard" || !raw.pgn) continue;
      games.push({
        externalId: raw.id,
        pgn: raw.pgn,
        whiteName: raw.players.white.user?.name ?? "Anonymous",
        blackName: raw.players.black.user?.name ?? "Anonymous",
        whiteElo: raw.players.white.rating ?? null,
        blackElo: raw.players.black.rating ?? null,
        result:
          raw.winner === "white"
            ? "WHITE_WIN"
            : raw.winner === "black"
              ? "BLACK_WIN"
              : raw.status === "draw" || raw.status === "stalemate"
                ? "DRAW"
                : "UNKNOWN",
        timeControl: raw.clock ? `${raw.clock.initial}+${raw.clock.increment}` : (raw.speed ?? null),
        playedAt: raw.createdAt ? new Date(raw.createdAt) : null,
      });
    }
    return games;
  }
}

interface LichessGame {
  id: string;
  variant: string;
  speed?: string;
  status: string;
  winner?: "white" | "black";
  createdAt?: number;
  clock?: { initial: number; increment: number };
  players: {
    white: { user?: { name: string }; rating?: number };
    black: { user?: { name: string }; rating?: number };
  };
  pgn?: string;
}

const CHESSCOM_DRAWS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

/**
 * Chess.com published-data API — keyless. Monthly archives, requested
 * serially (parallel requests are throttled), newest first.
 */
@Injectable()
export class ChesscomClient {
  private readonly logger = new Logger(ChesscomClient.name);

  private headers(): Record<string, string> {
    return { "User-Agent": process.env.CHESSCOM_USER_AGENT ?? "Tempo (github.com/tempo-chess)" };
  }

  async fetchRecentGames(username: string, max: number): Promise<ExternalGame[]> {
    const user = encodeURIComponent(username.toLowerCase());
    const archivesRes = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`, {
      headers: this.headers(),
    });
    if (archivesRes.status === 404) throw new PlatformError(`Chess.com user "${username}" not found`, "not_found");
    if (archivesRes.status === 429) throw new PlatformError("Chess.com rate limit hit — try again shortly", "rate_limited");
    if (!archivesRes.ok) throw new PlatformError(`Chess.com responded ${archivesRes.status}`, "upstream");

    const { archives } = (await archivesRes.json()) as { archives: string[] };
    const games: ExternalGame[] = [];

    for (const archiveUrl of [...archives].reverse()) {
      if (games.length >= max) break;
      const res = await fetch(archiveUrl, { headers: this.headers() });
      if (!res.ok) {
        this.logger.warn(`Skipping archive ${archiveUrl}: HTTP ${res.status}`);
        continue;
      }
      const { games: monthGames } = (await res.json()) as { games: ChesscomGame[] };
      for (const raw of [...monthGames].reverse()) {
        if (games.length >= max) break;
        if (raw.rules !== "chess" || !raw.pgn) continue;
        games.push({
          externalId: raw.uuid ?? raw.url,
          pgn: raw.pgn,
          whiteName: raw.white.username,
          blackName: raw.black.username,
          whiteElo: raw.white.rating ?? null,
          blackElo: raw.black.rating ?? null,
          result:
            raw.white.result === "win"
              ? "WHITE_WIN"
              : raw.black.result === "win"
                ? "BLACK_WIN"
                : CHESSCOM_DRAWS.has(raw.white.result)
                  ? "DRAW"
                  : "UNKNOWN",
          timeControl: raw.time_control ?? null,
          playedAt: raw.end_time ? new Date(raw.end_time * 1000) : null,
        });
      }
    }
    return games;
  }
}

interface ChesscomGame {
  url: string;
  uuid?: string;
  pgn?: string;
  rules: string;
  time_control?: string;
  end_time?: number;
  white: { username: string; rating?: number; result: string };
  black: { username: string; rating?: number; result: string };
}
