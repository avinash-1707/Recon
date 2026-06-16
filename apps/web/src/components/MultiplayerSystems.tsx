"use client";

import { useEffect } from "react";
import { useEngine } from "@/game/core/engineContext";
import { NetworkSystem } from "@/game/net/NetworkSystem";

/**
 * Registers the multiplayer relay system (snapshot send + inbound peer events).
 * Mounted only in multiplayer mode — single-player never touches the net layer.
 */
export function MultiplayerSystems() {
  const engine = useEngine();

  useEffect(() => {
    const net = new NetworkSystem(engine);
    engine.register(net);
    return () => engine.unregister(net.id);
  }, [engine]);

  return null;
}
