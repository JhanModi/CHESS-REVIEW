import { describe, expect, it } from "vitest";
import { mergeEvalSources } from "../src/analysis/eval-sources.js";

const ME = "user-me";
const OTHER = "user-other";

const own = (epd: string, depth: number, userId = ME) => ({ epd, depth, userId, source: "own" as const });
const trusted = (epd: string, depth: number) => ({ epd, depth, source: "trusted" as const });

describe("mergeEvalSources (ADR 008 eval trust)", () => {
  it("uses the user's own row when no trusted row exists", () => {
    const merged = mergeEvalSources(ME, [own("a", 16)], []);
    expect(merged.get("a")).toMatchObject({ source: "own", depth: 16 });
  });

  it("uses the trusted row when the user has none", () => {
    const merged = mergeEvalSources(ME, [], [trusted("a", 20)]);
    expect(merged.get("a")).toMatchObject({ source: "trusted", depth: 20 });
  });

  it("prefers whichever row is deeper", () => {
    const merged = mergeEvalSources(ME, [own("a", 24), own("b", 12)], [trusted("a", 18), trusted("b", 20)]);
    expect(merged.get("a")).toMatchObject({ source: "own", depth: 24 });
    expect(merged.get("b")).toMatchObject({ source: "trusted", depth: 20 });
  });

  it("lets the trusted row win a depth tie", () => {
    const merged = mergeEvalSources(ME, [own("a", 20)], [trusted("a", 20)]);
    expect(merged.get("a")).toMatchObject({ source: "trusted" });
  });

  it("never lets another user's row through, however deep", () => {
    const merged = mergeEvalSources(ME, [own("a", 99, OTHER), own("b", 99, OTHER)], [trusted("a", 18)]);
    expect(merged.get("a")).toMatchObject({ source: "trusted", depth: 18 });
    expect(merged.has("b")).toBe(false);
  });

  it("returns nothing for positions neither source knows", () => {
    expect(mergeEvalSources(ME, [own("a", 16)], [trusted("b", 16)]).has("c")).toBe(false);
  });
});
