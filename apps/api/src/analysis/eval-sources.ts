/**
 * Eval-trust policy (ADR 008).
 *
 * Two sources of raw position evaluations exist:
 * - **trusted**: server-produced rows in the shared `EngineEvaluation` cache;
 * - **own**: the requesting user's client-submitted `ClientEvaluation` rows.
 *
 * Client submissions are untrusted, so they must never influence another
 * user's analysis. A user's view of a position is therefore the deeper of
 * their own row and the trusted row — never anyone else's row. On equal
 * depth the trusted row wins, so a user can't shadow a server eval with a
 * same-depth forgery of their own.
 */

export interface EvalRow {
  epd: string;
  depth: number;
}

export interface OwnedEvalRow extends EvalRow {
  userId: string;
}

export function mergeEvalSources<O extends OwnedEvalRow, T extends EvalRow>(
  userId: string,
  own: readonly O[],
  trusted: readonly T[],
): Map<string, O | T> {
  const merged = new Map<string, O | T>();
  for (const row of trusted) {
    const existing = merged.get(row.epd);
    if (!existing || row.depth > existing.depth) merged.set(row.epd, row);
  }
  for (const row of own) {
    // Defence in depth: callers query by userId, but never let a foreign row through.
    if (row.userId !== userId) continue;
    const existing = merged.get(row.epd);
    if (!existing || row.depth > existing.depth) merged.set(row.epd, row);
  }
  return merged;
}
