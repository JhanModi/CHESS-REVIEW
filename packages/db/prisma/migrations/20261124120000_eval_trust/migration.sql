-- ADR 008: client-submitted evaluations become per-user; EngineEvaluation
-- becomes the trusted (server-produced only) cross-user cache.

-- CreateTable
CREATE TABLE "ClientEvaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "epd" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "evalCp" INTEGER,
    "evalMate" INTEGER,
    "bestMoveUci" TEXT NOT NULL,
    "pv" TEXT NOT NULL,
    "multiPv" JSONB,
    "nodes" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientEvaluation_userId_epd_key" ON "ClientEvaluation"("userId", "epd");

-- AddForeignKey
ALTER TABLE "ClientEvaluation" ADD CONSTRAINT "ClientEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing EngineEvaluation row was client-submitted. Copy,
-- per user, the rows covering the positions of that user's own analysed games
-- (each move's resulting position, plus the standard start position for games
-- without a custom [FEN] header), so existing analyses keep resuming and
-- re-deriving exactly as before. UNION de-duplicates (userId, epd).
-- Custom-FEN games lose only their start-position row and self-heal: the next
-- derive stops at ply 0 and the client re-analyses that one position.
INSERT INTO "ClientEvaluation" (
    "id", "userId", "epd", "engineId", "depth", "evalCp", "evalMate",
    "bestMoveUci", "pv", "multiPv", "nodes", "updatedAt"
)
SELECT
    gen_random_uuid()::text, ge."userId", e."epd", e."engineId", e."depth",
    e."evalCp", e."evalMate", e."bestMoveUci", e."pv", e."multiPv", e."nodes",
    e."updatedAt"
FROM (
    SELECT g."userId", m."epdAfter" AS "epd"
    FROM "Move" m
    JOIN "Game" g ON g."id" = m."gameId"
    JOIN "Analysis" a ON a."gameId" = g."id"
    UNION
    SELECT g."userId", 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    FROM "Game" g
    JOIN "Analysis" a ON a."gameId" = g."id"
    WHERE g."pgn" NOT LIKE '%[FEN %'
) ge
JOIN "EngineEvaluation" e ON e."epd" = ge."epd";

-- The shared cache held only untrusted client submissions; their content now
-- lives in the per-user copies above. From here on, only server-produced
-- evaluations are written to it.
DELETE FROM "EngineEvaluation";
