"use client";

import { useEffect, useState } from "react";

/**
 * Re-renders on a slow interval so relative timestamps stay honest.
 *
 * `formatRelativeDate` reads `Date.now()` when it renders, so without something
 * nudging the component "Just now" stays "Just now" until an unrelated state
 * change happens to repaint it. On a quiet screen that can be an hour, which
 * makes the whole app look frozen.
 *
 * One interval per component is cheap at this cadence, and it stops entirely
 * while the tab is hidden — nobody needs a timestamp updated in a background
 * tab, and it catches up on the way back.
 */
const DEFAULT_INTERVAL_MS = 60_000;

export function useTickingClock(intervalMs = DEFAULT_INTERVAL_MS) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const advance = () => setTick((value) => value + 1);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      advance();
    }, intervalMs);

    // Coming back to the tab should show the current time immediately rather
    // than whatever it said when the tab lost focus.
    const onVisible = () => {
      if (document.visibilityState === "visible") advance();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
