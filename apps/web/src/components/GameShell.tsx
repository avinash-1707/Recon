"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/game/state/appStore";
import { useNetStore } from "@/game/state/netStore";
import { MainMenu } from "@/components/menu/MainMenu";
import { LoadingScreen } from "@/components/LoadingScreen";

// The WebGL canvas must never render on the server. Load it client-only,
// showing the loading screen as the fallback while the chunk + assets stream in.
const GameCanvas = dynamic(
  () => import("@/components/GameCanvas").then((m) => m.GameCanvas),
  {
    ssr: false,
    loading: () => <LoadingScreen progress={0} label="Booting engine" />,
  },
);

export function GameShell() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const phase = useNetStore((s) => s.phase);

  // If a multiplayer session drops (disconnect/leave → phase "idle"), fall back
  // to the menu rather than leaving a dead canvas mounted.
  useEffect(() => {
    if (mode === "multiplayer" && phase === "idle") setMode("menu");
  }, [mode, phase, setMode]);

  if (mode === "menu") return <MainMenu />;
  return <GameCanvas mode={mode} />;
}
