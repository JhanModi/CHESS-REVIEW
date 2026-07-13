"use client";

import { useEffect } from "react";
import { useReviewStore } from "@/stores/review-store";

/**
 * Review-page shortcuts: ←/→ step, Home/End (or ↑/↓) jump, f flip,
 * space toggles autoplay. While an engine-line preview is open, ←/→ step the
 * variation, space pauses/resumes it and Escape closes it.
 * Ignored while typing in inputs.
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
        case "Escape":
          if (!store.variation) return;
          store.exitVariation();
          break;
        case " ":
          if (store.variation) store.setVariationPlaying(!store.variation.playing);
          else store.setAutoplay(!store.autoplay);
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

/** Drives game autoplay and engine-line playback while enabled. */
export function useAutoplay(intervalMs = 1100, variationIntervalMs = 900): void {
  const autoplay = useReviewStore((s) => s.autoplay);
  const variationPlaying = useReviewStore((s) => s.variation?.playing ?? false);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => useReviewStore.getState().next(), intervalMs);
    return () => clearInterval(id);
  }, [autoplay, intervalMs]);

  useEffect(() => {
    if (!variationPlaying) return;
    const id = setInterval(() => useReviewStore.getState().variationNext(), variationIntervalMs);
    return () => clearInterval(id);
  }, [variationPlaying, variationIntervalMs]);
}
