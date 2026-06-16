import next from "eslint-config-next";
import { reconIgnores } from "./base.mjs";

// eslint-config-next v16 ships a native flat config array (core-web-vitals +
// typescript). Spread it directly — do NOT wrap it in FlatCompat, which chokes
// on the config's circular plugin references.

/** Pull a plugin instance out of the next config so we can reuse the SAME
 *  reference in our override object (flat config errors on redefining a plugin
 *  with a different instance, and scopes plugins per object). */
function findPlugin(name) {
  for (const entry of next) {
    const plugin = entry?.plugins?.[name];
    if (plugin) return plugin;
  }
  return undefined;
}

export function reconWebConfig() {
  const overrides = {
    plugins: {},
    rules: {
      // Keep `any` out of the engine/game code (mutating Three.js refs is fine without it).
      "@typescript-eslint/no-explicit-any": "error",
      // Intentional engine-bootstrap + mount-time touch/HUD sync patterns.
      // Surface as warnings instead of blocking; revisit in polish (CP7).
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  };
  const ts = findPlugin("@typescript-eslint");
  const reactHooks = findPlugin("react-hooks");
  if (ts) overrides.plugins["@typescript-eslint"] = ts;
  if (reactHooks) overrides.plugins["react-hooks"] = reactHooks;

  return [...next, overrides, reconIgnores];
}

export default reconWebConfig;
