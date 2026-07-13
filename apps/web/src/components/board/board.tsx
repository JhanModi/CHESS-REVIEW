"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { MoveClassification } from "@tempo/types";
import { fileOf, rankOf, type BoardSnapshot } from "@/lib/board/piece-track";
import { CLASSIFICATION_META } from "@/components/review/classification-badge";
import { cn } from "@/lib/utils";

export interface BoardProps {
  snapshot: BoardSnapshot;
  orientation: "white" | "black";
  lastMove?: { from: number; to: number } | null;
  checkSquare?: number | null;
  badge?: { square: number; classification: MoveClassification } | null;
  /** Engine suggestion arrow (best move in the shown position). */
  arrow?: { from: number; to: number } | null;
  className?: string;
}

/** Display coordinates (0..7 from top-left) for a board square. */
function displayXY(square: number, orientation: "white" | "black"): { x: number; y: number } {
  const file = fileOf(square);
  const rank = rankOf(square);
  return orientation === "white" ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank };
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function Squares({ orientation }: { orientation: "white" | "black" }) {
  return (
    <>
      {Array.from({ length: 64 }, (_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const dark = (x + y) % 2 === 1;
        const isBottom = y === 7;
        const isLeft = x === 0;
        const fileLabel = orientation === "white" ? FILES[x] : FILES[7 - x];
        const rankLabel = orientation === "white" ? String(8 - y) : String(y + 1);
        return (
          <div
            key={i}
            className={cn("relative", dark ? "bg-board-dark" : "bg-board-light")}
            style={{ gridColumn: x + 1, gridRow: y + 1 }}
          >
            {isBottom && (
              <span
                className={cn(
                  "pointer-events-none absolute bottom-0.5 right-1 text-[min(1.6vw,10px)] font-semibold",
                  dark ? "text-board-light" : "text-board-dark",
                )}
              >
                {fileLabel}
              </span>
            )}
            {isLeft && (
              <span
                className={cn(
                  "pointer-events-none absolute left-1 top-0.5 text-[min(1.6vw,10px)] font-semibold",
                  dark ? "text-board-light" : "text-board-dark",
                )}
              >
                {rankLabel}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function SquareOverlay({
  square,
  orientation,
  className,
  style,
  children,
}: {
  square: number;
  orientation: "white" | "black";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const { x, y } = displayXY(square, orientation);
  return (
    <div
      className={cn("pointer-events-none absolute h-[12.5%] w-[12.5%]", className)}
      style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%`, ...style }}
    >
      {children}
    </div>
  );
}

function Arrow({ from, to, orientation }: { from: number; to: number; orientation: "white" | "black" }) {
  const a = displayXY(from, orientation);
  const b = displayXY(to, orientation);
  const x1 = a.x + 0.5;
  const y1 = a.y + 0.5;
  const x2 = b.x + 0.5;
  const y2 = b.y + 0.5;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  // Pull the arrow tip back so the head doesn't cover the target piece centre.
  const tipX = x2 - Math.cos(angle) * 0.28;
  const tipY = y2 - Math.sin(angle) * 0.28;
  const headSize = 0.32;
  const hx1 = tipX - Math.cos(angle - 0.5) * headSize;
  const hy1 = tipY - Math.sin(angle - 0.5) * headSize;
  const hx2 = tipX - Math.cos(angle + 0.5) * headSize;
  const hy2 = tipY - Math.sin(angle + 0.5) * headSize;
  return (
    <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 h-full w-full">
      <line
        x1={x1}
        y1={y1}
        x2={tipX - Math.cos(angle) * 0.12}
        y2={tipY - Math.sin(angle) * 0.12}
        stroke="var(--board-arrow)"
        strokeWidth={0.18}
        strokeLinecap="round"
      />
      <polygon points={`${tipX},${tipY} ${hx1},${hy1} ${hx2},${hy2}`} fill="var(--board-arrow)" />
    </svg>
  );
}

export const Board = memo(function Board({
  snapshot,
  orientation,
  lastMove,
  checkSquare,
  badge,
  arrow,
  className,
}: BoardProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full select-none overflow-hidden rounded-lg shadow-md",
        className,
      )}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        <Squares orientation={orientation} />
      </div>

      {lastMove && (
        <>
          <SquareOverlay square={lastMove.from} orientation={orientation} style={{ background: "var(--board-highlight)" }} />
          <SquareOverlay square={lastMove.to} orientation={orientation} style={{ background: "var(--board-highlight)" }} />
        </>
      )}
      {checkSquare != null && (
        <SquareOverlay
          square={checkSquare}
          orientation={orientation}
          style={{ background: "radial-gradient(circle, var(--board-check) 0%, transparent 72%)" }}
        />
      )}

      {snapshot.map((piece) => {
        const { x, y } = displayXY(piece.square, orientation);
        return (
          <motion.div
            key={piece.id}
            className="absolute left-0 top-0 h-[12.5%] w-[12.5%]"
            initial={false}
            animate={{ x: `${x * 100}%`, y: `${y * 100}%` }}
            transition={{ type: "tween", duration: 0.16, ease: "easeOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/pieces/rhosgfx/${piece.color}${piece.role.toUpperCase()}.svg`}
              alt=""
              draggable={false}
              className="h-full w-full"
            />
          </motion.div>
        );
      })}

      {arrow && <Arrow from={arrow.from} to={arrow.to} orientation={orientation} />}

      {badge && (
        <SquareOverlay square={badge.square} orientation={orientation} className="z-10">
          <span
            className="absolute -right-1 -top-1 flex h-[42%] min-w-[42%] items-center justify-center rounded-full px-0.5 text-[min(2.2vw,13px)] font-bold text-white shadow"
            style={{ backgroundColor: `var(${CLASSIFICATION_META[badge.classification].varName})` }}
          >
            {CLASSIFICATION_META[badge.classification].symbol}
          </span>
        </SquareOverlay>
      )}
    </div>
  );
});
