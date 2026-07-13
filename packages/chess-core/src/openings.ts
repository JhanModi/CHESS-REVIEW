import { OPENINGS_JSON } from "./openings.data.js";
import type { OpeningRecord, ParsedMove } from "./types.js";

/** Full ECO dataset (lichess-org/chess-openings, public domain). */
export const openingsDataset: readonly OpeningRecord[] = JSON.parse(OPENINGS_JSON) as OpeningRecord[];

const byEpd = new Map(openingsDataset.map((o) => [o.epd, o]));

/** Position-keyed lookup — transposition-safe (ADR 006 rationale). */
export function lookupOpeningByEpd(epd: string): OpeningRecord | undefined {
  return byEpd.get(epd);
}

export function isBookPosition(epd: string): boolean {
  return byEpd.has(epd);
}

/** How deep into a game we still consider opening-book positions. */
export const MAX_BOOK_PLY = 40;

export interface OpeningMatch {
  opening: OpeningRecord;
  /** Last ply that was still a known book position. */
  lastBookPly: number;
}

/**
 * Finds the deepest known opening position reached in a game. Walking every
 * ply (not stopping at the first miss) handles transpositions back into book.
 */
export function findOpening(moves: readonly Pick<ParsedMove, "ply" | "epdAfter">[]): OpeningMatch | undefined {
  let match: OpeningMatch | undefined;
  for (const move of moves) {
    if (move.ply > MAX_BOOK_PLY) break;
    const opening = byEpd.get(move.epdAfter);
    if (opening) match = { opening, lastBookPly: move.ply };
  }
  return match;
}
