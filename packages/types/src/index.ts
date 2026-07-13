/**
 * @tempo/types — the single source of truth for DTOs crossing the web↔api
 * boundary. Request bodies are zod schemas (validated at the API edge);
 * response shapes are interfaces implemented by API serializers.
 */
import { z } from "zod";

// ─────────────────────────────────────────────── shared enums / primitives ──

export const GAME_SOURCES = ["UPLOAD", "PASTE", "LICHESS", "CHESSCOM"] as const;
export type GameSource = (typeof GAME_SOURCES)[number];

export const GAME_RESULTS = ["WHITE_WIN", "BLACK_WIN", "DRAW", "UNKNOWN"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

export const MOVE_CLASSIFICATIONS = [
  "BRILLIANT",
  "GREAT",
  "BEST",
  "EXCELLENT",
  "GOOD",
  "BOOK",
  "INACCURACY",
  "MISTAKE",
  "BLUNDER",
  "MISS",
  "FORCED",
] as const;
export type MoveClassification = (typeof MOVE_CLASSIFICATIONS)[number];

export const ANALYSIS_STATUSES = ["PENDING", "PARTIAL", "COMPLETE", "FAILED"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const IMPORT_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

const uciMove = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, "not a UCI move");

// ───────────────────────────────────────────────────────── games ────────────

export const createGamesSchema = z.object({
  pgn: z.string().min(4).max(2_000_000),
  source: z.enum(["UPLOAD", "PASTE"]).default("PASTE"),
});
export type CreateGamesRequest = z.infer<typeof createGamesSchema>;

export const listGamesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  source: z.enum(GAME_SOURCES).optional(),
  result: z.enum(GAME_RESULTS).optional(),
  analysed: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;

// ───────────────────────────────────────────────────────── imports ──────────

export const importRequestSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[\w.-]+$/, "invalid username"),
  /** Most-recent games to fetch. */
  max: z.coerce.number().int().min(1).max(200).default(50),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

// ───────────────────────────────────────────────────────── analysis ─────────

/** One engine line for one position. Scores are white-POV. */
export const pvLineSchema = z
  .object({
    moveUci: uciMove,
    cp: z.number().int().min(-100_000).max(100_000).optional(),
    mate: z.number().int().min(-200).max(200).optional(),
    pv: z.array(uciMove).max(64).default([]),
  })
  .refine((line) => (line.cp === undefined) !== (line.mate === undefined), {
    message: "exactly one of cp/mate required",
  });

/**
 * Evaluation of one *position* in the game. Index 0 = the starting position,
 * index i = the position after ply i. Per-move records are derived
 * server-side from consecutive positions (ADR 007).
 */
export const positionEvalSchema = z.object({
  index: z.number().int().min(0).max(1024),
  depth: z.number().int().min(1).max(99),
  lines: z.array(pvLineSchema).min(1).max(4),
  nodes: z.number().int().nonnegative().optional(),
});
export type PositionEval = z.infer<typeof positionEvalSchema>;

export const submitAnalysisSchema = z.object({
  engineId: z.string().min(1).max(64),
  targetDepth: z.number().int().min(6).max(40),
  positions: z.array(positionEvalSchema).min(1).max(1025),
});
export type SubmitAnalysisRequest = z.infer<typeof submitAnalysisSchema>;

export const evalCacheQuerySchema = z.object({
  /** Comma-separated EPDs (URL-encoded). */
  epds: z.string().min(1).max(20_000),
});

// ───────────────────────────────────────────────────────── settings ─────────

export const thresholdSettingsSchema = z.object({
  excellent: z.number().min(0).max(100),
  inaccuracy: z.number().min(0).max(100),
  mistake: z.number().min(0).max(100),
  blunder: z.number().min(0).max(100),
  greatGap: z.number().min(0).max(100),
  brilliantMaxLoss: z.number().min(0).max(100),
  brilliantMinWinAfter: z.number().min(0).max(100),
  brilliantMaxWinBefore: z.number().min(0).max(100),
  missWinBefore: z.number().min(0).max(101),
  missMinLoss: z.number().min(0).max(100),
  missWinAfterFloor: z.number().min(0).max(100),
});

export const updateSettingsSchema = z.object({
  thresholds: thresholdSettingsSchema.partial().optional(),
  boardTheme: z.enum(["classic", "slate", "walnut"]).optional(),
  language: z.string().min(2).max(8).optional(),
});
export type UpdateSettingsRequest = z.infer<typeof updateSettingsSchema>;

// ─────────────────────────────────────────────── response shapes (API → web) ─

export interface UserDto {
  id: string;
  email: string;
  displayName: string | null;
  plan: "FREE" | "PRO";
  settings: Record<string, unknown>;
}

export interface GameListItemDto {
  id: string;
  source: GameSource;
  whiteName: string;
  blackName: string;
  whiteElo: number | null;
  blackElo: number | null;
  userColor: "WHITE" | "BLACK" | null;
  result: GameResult;
  timeControl: string | null;
  eco: string | null;
  openingName: string | null;
  playedAt: string | null;
  createdAt: string;
  analysisStatus: AnalysisStatus | null;
  userAccuracy: number | null;
}

export interface MoveDto {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  epdAfter: string;
  clockSeconds: number | null;
}

export interface MoveAnalysisDto {
  ply: number;
  evalBeforeCp: number | null;
  evalBeforeMate: number | null;
  evalAfterCp: number | null;
  evalAfterMate: number | null;
  bestMoveUci: string;
  bestLinePv: string;
  secondMoveUci: string | null;
  secondCp: number | null;
  secondMate: number | null;
  depth: number;
  winBefore: number;
  winAfter: number;
  cpLoss: number;
  accuracy: number;
  classification: MoveClassification;
}

export interface AnalysisDto {
  status: AnalysisStatus;
  engineId: string;
  targetDepth: number;
  lastPly: number;
  accuracyWhite: number | null;
  accuracyBlack: number | null;
  acplWhite: number | null;
  acplBlack: number | null;
  summary: Record<string, unknown> | null;
  moves: MoveAnalysisDto[];
}

export interface GameDetailDto extends GameListItemDto {
  pgn: string;
  initialFen: string | null;
  moves: MoveDto[];
  analysis: AnalysisDto | null;
  shareSlug: string | null;
}

export interface EvalCacheEntryDto {
  epd: string;
  engineId: string;
  depth: number;
  lines: Array<{ moveUci: string; cp?: number; mate?: number; pv: string[] }>;
}

export interface ImportJobDto {
  id: string;
  source: GameSource;
  username: string;
  status: ImportStatus;
  totalGames: number | null;
  gamesImported: number;
  gamesSkipped: number;
  error: string | null;
  createdAt: string;
}

export interface DashboardStatsDto {
  totalGames: number;
  analysedGames: number;
  winRate: { wins: number; losses: number; draws: number } | null;
  averageAccuracy: number | null;
  averageAcpl: number | null;
  accuracyTrend: Array<{ gameId: string; playedAt: string | null; accuracy: number }>;
  labelDistribution: Partial<Record<MoveClassification, number>>;
  topOpenings: Array<{ eco: string; name: string; games: number; score: number }>;
  recentGames: GameListItemDto[];
}

export interface PagedDto<T> {
  items: T[];
  nextCursor: string | null;
}
