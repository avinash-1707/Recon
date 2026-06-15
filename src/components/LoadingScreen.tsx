"use client";

interface LoadingScreenProps {
  /** 0..100 */
  progress: number;
  label?: string;
}

/**
 * Full-screen overlay shown while the engine chunk and GLB/texture assets stream.
 * Pure DOM (no WebGL) so it can paint before the canvas mounts.
 */
export function LoadingScreen({ progress, label = "Loading" }: LoadingScreenProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        background: "radial-gradient(120% 120% at 50% 30%, #0c1219 0%, #05070a 70%)",
        zIndex: 100,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.5em",
          textTransform: "uppercase",
          color: "var(--hud-accent)",
          opacity: 0.85,
        }}
      >
        Recon
      </div>
      <div style={{ width: "min(360px, 60vw)" }}>
        <div
          style={{
            height: 3,
            width: "100%",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--hud-accent)",
              transition: "width 120ms linear",
            }}
          />
        </div>
        <div
          style={{
            marginTop: "0.6rem",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            opacity: 0.6,
          }}
        >
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
