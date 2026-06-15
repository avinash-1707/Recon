import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // r3f + rapier double-init poorly under StrictMode's double-invoke. Off for the game canvas.
  reactStrictMode: false,
  // three ecosystem ships untranspiled ESM; let Next transpile it.
  transpilePackages: ["three"],
};

export default nextConfig;
