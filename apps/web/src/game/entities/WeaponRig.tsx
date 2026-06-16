"use client";

import { useEffect } from "react";
import { useEngine } from "@/game/core/engineContext";
import { FxSystem } from "@/game/systems/effects";
import { AudioSystem } from "@/game/systems/audio";
import { WeaponSystem } from "@/game/systems/weapons";
import { ViewmodelSystem } from "@/game/systems/viewmodel";
import { TEST_MODE } from "@/game/systems/input";
import { useWeaponStore } from "@/game/state/weaponStore";
import { useHudStore } from "@/game/state/hudStore";
import { usePlayerStore } from "@/game/state/playerStore";
import { weaponRuntime } from "@/game/state/runtime";

/**
 * Mounts the weapon stack: FX pools, the weapon logic system (which drives FX),
 * and the first-person viewmodel. Registered together so WeaponSystem can hold
 * the FxSystem reference directly.
 */
export function WeaponRig() {
  const engine = useEngine();

  useEffect(() => {
    if (TEST_MODE) {
      (window as unknown as { __recon?: unknown }).__recon = {
        weapon: () => useWeaponStore.getState(),
        runtime: () => ({ ...weaponRuntime }),
        hud: () => useHudStore.getState(),
        player: () => usePlayerStore.getState(),
      };
    }
    const fx = new FxSystem();
    const audio = new AudioSystem();
    const weapons = new WeaponSystem(fx, audio);
    const viewmodel = new ViewmodelSystem();
    engine.register(fx);
    engine.register(audio);
    engine.register(weapons);
    engine.register(viewmodel);
    return () => {
      engine.unregister(viewmodel.id);
      engine.unregister(weapons.id);
      engine.unregister(audio.id);
      engine.unregister(fx.id);
    };
  }, [engine]);

  return null;
}
