import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // r3f + rapier double-init poorly under StrictMode's double-invoke. Off for the game canvas.
  reactStrictMode: false,
  // three ships untranspiled ESM; @recon/* workspace packages ship raw TS.
  // Next must transpile all of them.
  transpilePackages: ["three", "@recon/protocol"],
};

export default nextConfig;
