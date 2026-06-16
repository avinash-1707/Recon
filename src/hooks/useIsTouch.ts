"use client";

import { useEffect, useState } from "react";

/**
 * True on touch-primary devices (phones/tablets). Detected once on mount so it
 * never differs between SSR and the first client render - starts false on the
 * server, then resolves on the client.
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const coarse =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouch(coarse || hasTouch);
  }, []);

  return isTouch;
}
