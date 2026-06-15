"use client";

import dynamic from "next/dynamic";
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
  return <GameCanvas />;
}
