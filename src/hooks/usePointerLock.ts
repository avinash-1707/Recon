"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks pointer-lock state and exposes a `request()` to engage it (call from a
 * user gesture — click). The WebGL canvas is found under #game-root.
 */
export function usePointerLock(): { locked: boolean; request: () => void } {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  const request = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-root canvas");
    canvas?.requestPointerLock();
  }, []);

  return { locked, request };
}
