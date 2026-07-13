/**
 * Pure UCI text-protocol codec. No transport, no engine — just parsing and
 * command building, so the whole protocol layer is unit-testable with string
 * fixtures.
 */

/** Score as reported by UCI: side-to-move perspective. */
export interface UciScore {
  cp?: number;
  mate?: number;
  /** Present when the engine reported a bound instead of an exact score. */
  bound?: "lower" | "upper";
}

export interface UciInfo {
  depth?: number;
  selDepth?: number;
  multiPv?: number;
  score?: UciScore;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  pv?: string[];
}

/** Parses an `info …` line. Returns null for lines without eval content. */
export function parseInfoLine(line: string): UciInfo | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.trim().split(/\s+/);
  const info: UciInfo = {};
  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];
    switch (tok) {
      case "depth":
        info.depth = Number(tokens[++i]);
        i++;
        break;
      case "seldepth":
        info.selDepth = Number(tokens[++i]);
        i++;
        break;
      case "multipv":
        info.multiPv = Number(tokens[++i]);
        i++;
        break;
      case "nodes":
        info.nodes = Number(tokens[++i]);
        i++;
        break;
      case "nps":
        info.nps = Number(tokens[++i]);
        i++;
        break;
      case "time":
        info.timeMs = Number(tokens[++i]);
        i++;
        break;
      case "score": {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        info.score = kind === "mate" ? { mate: value } : { cp: value };
        const next = tokens[i + 1];
        if (next === "lowerbound" || next === "upperbound") {
          info.score.bound = next === "lowerbound" ? "lower" : "upper";
          i++;
        }
        i++;
        break;
      }
      case "pv":
        info.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      default:
        // Unknown token (currmove, hashfull, …) — skip it and its value-less
        // continuation safely by advancing one token.
        i++;
        break;
    }
  }
  return info;
}

/** Parses a `bestmove …` line; returns the move or null. */
export function parseBestMoveLine(line: string): string | null {
  if (!line.startsWith("bestmove")) return null;
  const move = line.trim().split(/\s+/)[1];
  // "(none)" happens on mate/stalemate positions.
  if (!move || move === "(none)") return null;
  return move;
}

export function buildGoCommand(req: { depth?: number; moveTimeMs?: number }): string {
  if (req.depth !== undefined) return `go depth ${req.depth}`;
  if (req.moveTimeMs !== undefined) return `go movetime ${req.moveTimeMs}`;
  throw new Error("AnalyseRequest needs depth or moveTimeMs");
}

export function buildPositionCommand(fen: string): string {
  return `position fen ${fen}`;
}

export function buildSetOption(name: string, value: string | number): string {
  return `setoption name ${name} value ${value}`;
}

/** Whose turn it is according to a FEN string. */
export function fenTurn(fen: string): "white" | "black" {
  return fen.split(/\s+/)[1] === "b" ? "black" : "white";
}

/** Converts a side-to-move UCI score into a white-POV score. */
export function toWhitePov(score: UciScore, turn: "white" | "black"): { cp?: number; mate?: number } {
  if (turn === "white") {
    return score.mate !== undefined ? { mate: score.mate } : { cp: score.cp };
  }
  return score.mate !== undefined ? { mate: -score.mate } : { cp: score.cp === undefined ? undefined : -score.cp };
}
