"use client";

import { useEffect } from "react";
import { useReviewStore } from "@/stores/review-store";

/**
 * Review-page shortcuts: ←/→ step, Home/End (or ↑/↓) jump, f flip,
 * space toggles autoplay. Ignored while typing in inputs.
 */
export function useKeyboardNav(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const store = useReviewStore.getState();
      switch (event.key) {
        case "ArrowLeft":
          store.prev();
          break;
        case "ArrowRight":
          store.next();
          break;
        case "ArrowUp":
        case "Home":
          store.first();
          break;
        case "ArrowDown":
        case "End":
          store.last();
          break;
        case "f":
          store.flip();
          break;
        case " ":
          store.setAutoplay(!store.autoplay);
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Drives autoplay while enabled. */
export function useAutoplay(intervalMs = 1100): void {
  const autoplay = useReviewStore((s) => s.autoplay);
  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => useReviewStore.getState().next(), intervalMs);
    return () => clearInterval(id);
  }, [autoplay, intervalMs]);
}
