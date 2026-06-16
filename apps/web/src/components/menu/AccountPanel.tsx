"use client";

/**
 * AccountPanel — optional credential auth for stat persistence.
 * Designed to match the MainMenu tactical/HUD aesthetic exactly.
 * Auth is always optional — guests continue to play without signing in.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn, signUp, signOut } from "@/game/net/authClient";
import { useNetStore } from "@/game/state/netStore";

// ── Design tokens (must mirror MainMenu.tsx exactly) ────────────────────────
const ACCENT = "#4cc9f0";
const FG = "#d7e2e6";
const MUTED = "rgba(215,226,230,0.45)";
const DANGER = "#e84a4a";
// BG intentionally omitted — not used in this component (MainMenu owns the page background)
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";
const BORDER = "rgba(76,201,240,0.18)";
const BORDER_DIM = "rgba(215,226,230,0.10)";

// ── Style injection guard ────────────────────────────────────────────────────
let accountStyleInjected = false;
function ensureAccountStyles() {
  if (typeof document === "undefined" || accountStyleInjected) return;
  accountStyleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes account-expand {
      from { opacity: 0; transform: translateY(-6px); max-height: 0; }
      to   { opacity: 1; transform: translateY(0);    max-height: 400px; }
    }
    @keyframes account-collapse {
      from { opacity: 1; transform: translateY(0);    max-height: 400px; }
      to   { opacity: 0; transform: translateY(-6px); max-height: 0; }
    }
    @keyframes account-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes account-spinner {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes account-error-shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-4px); }
      40%       { transform: translateX(4px); }
      60%       { transform: translateX(-2px); }
      80%       { transform: translateX(2px); }
    }
    .account-toggle-btn {
      background: none;
      border: none;
      cursor: pointer;
      transition: color 120ms, opacity 120ms;
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
    }
    .account-toggle-btn:hover {
      opacity: 1 !important;
    }
    .account-tab {
      background: none;
      border: none;
      cursor: pointer;
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
      transition: color 120ms, border-color 120ms, background 120ms;
    }
    .account-tab:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
    .account-submit-btn {
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: background 150ms, border-color 150ms, color 150ms, box-shadow 150ms;
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
    }
    .account-submit-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(255,255,255,0.04), transparent);
      pointer-events: none;
    }
    .account-submit-btn:hover:not(:disabled) {
      background: rgba(76,201,240,0.16) !important;
      border-color: rgba(76,201,240,0.5) !important;
      box-shadow: 0 0 14px rgba(76,201,240,0.22);
    }
    .account-submit-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .account-signout-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
      transition: color 120ms, opacity 120ms;
    }
    .account-signout-btn:hover {
      color: ${DANGER} !important;
    }
    .account-input {
      background: rgba(5,7,10,0.7);
      border: 1px solid ${BORDER_DIM};
      color: ${FG};
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      outline: none;
      transition: border-color 140ms, box-shadow 140ms;
      width: 100%;
      box-sizing: border-box;
    }
    .account-input::placeholder {
      color: rgba(215,226,230,0.22);
      letter-spacing: 0.08em;
    }
    .account-input:focus {
      border-color: rgba(76,201,240,0.45);
      box-shadow: 0 0 0 1px rgba(76,201,240,0.12), inset 0 1px 3px rgba(0,0,0,0.4);
    }
    .account-input:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(el);
}

// ── Inline spinner (matches Spinner in MainMenu) ─────────────────────────────
function AccountSpinner() {
  return (
    <div
      style={{
        width: 11,
        height: 11,
        border: "1.5px solid rgba(76,201,240,0.25)",
        borderTopColor: ACCENT,
        borderRadius: "50%",
        display: "inline-block",
        animation: "account-spinner 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── Validation helpers ───────────────────────────────────────────────────────
function validateEmail(email: string): string | null {
  if (!email.trim()) return "EMAIL REQUIRED";
  if (!email.includes("@")) return "INVALID EMAIL — MUST CONTAIN @";
  return null;
}
function validatePassword(pw: string, isSignUp: boolean): string | null {
  if (!pw) return "PASSWORD REQUIRED";
  if (isSignUp && pw.length < 8) return "PASSWORD MIN 8 CHARACTERS";
  return null;
}
function validateName(name: string): string | null {
  const t = name.trim();
  if (!t) return "CALL SIGN REQUIRED";
  if (t.length > 24) return "CALL SIGN MAX 24 CHARACTERS";
  return null;
}

// ── Main component ───────────────────────────────────────────────────────────
type AuthTab = "signin" | "signup";

export function AccountPanel() {
  const { data: session, isPending: sessionPending } = useSession();
  const setHandle = useNetStore((s) => s.setHandle);
  const handle = useNetStore((s) => s.handle);

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<AuthTab>("signin");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Inject styles once
  useEffect(() => {
    ensureAccountStyles();
  }, []);

  // When session becomes available and handle is empty, seed it from name
  useEffect(() => {
    if (session?.user.name && !handle.trim()) {
      setHandle(session.user.name);
    }
  }, [session, handle, setHandle]);

  // Focus first input when panel expands
  useEffect(() => {
    if (expanded && !session) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [expanded, session]);

  // Reset form on tab switch
  const handleTabSwitch = useCallback((t: AuthTab) => {
    setTab(t);
    setAuthError(null);
    setEmail("");
    setPassword("");
    setName("");
  }, []);

  // Close the auth panel when the session transitions from absent → present.
  // We only expand=false when the user was NOT signed in before this render.
  // Using a ref to detect the transition avoids running the full effect body
  // on every dependency change while keeping the linter happy.
  const hadSessionRef = useRef<boolean>(!!session);
  useEffect(() => {
    const hasSession = !!session;
    if (hasSession && !hadSessionRef.current) {
      // Newly signed in — collapse the form and clear fields.
      setExpanded(false);
      setEmail("");
      setPassword("");
      setName("");
      setAuthError(null);
    }
    hadSessionRef.current = hasSession;
  }, [session]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setAuthError(null);

    const trimEmail = email.trim();
    const trimName = name.trim();
    const trimPw = password;

    // Client-side validation
    const emailErr = validateEmail(trimEmail);
    if (emailErr) { setAuthError(emailErr); return; }
    const pwErr = validatePassword(trimPw, tab === "signup");
    if (pwErr) { setAuthError(pwErr); return; }
    if (tab === "signup") {
      const nameErr = validateName(trimName);
      if (nameErr) { setAuthError(nameErr); return; }
    }

    setSubmitting(true);
    try {
      if (tab === "signin") {
        const result = await signIn.email({ email: trimEmail, password: trimPw });
        if (result.error) {
          setAuthError((result.error.message ?? "SIGN IN FAILED").toUpperCase());
        }
      } else {
        const result = await signUp.email({ email: trimEmail, password: trimPw, name: trimName });
        if (result.error) {
          setAuthError((result.error.message ?? "SIGN UP FAILED").toUpperCase());
        }
      }
    } catch (err) {
      // Network error / auth disabled server-side — surface gracefully
      const msg = err instanceof Error ? err.message : "SERVER UNAVAILABLE";
      setAuthError(msg.toUpperCase());
    } finally {
      setSubmitting(false);
    }
  }, [submitting, email, password, name, tab]);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Ignore signout errors — treat as signed out anyway
    } finally {
      setSigningOut(false);
    }
  }, [signingOut]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !submitting) {
        void handleSubmit();
      }
    },
    [handleSubmit, submitting]
  );

  // ── Loading: session not yet known ─────────────────────────────────────────
  if (sessionPending) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: 0.4,
        }}
      >
        <AccountSpinner />
        <span style={{ fontSize: "0.48rem", letterSpacing: "0.28em", color: MUTED }}>IDENT</span>
      </div>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────
  if (session) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          animation: "account-fade-in 0.3s ease-out forwards",
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#6fdc8c",
            boxShadow: "0 0 5px rgba(111,220,140,0.8)",
            flexShrink: 0,
          }}
        />
        {/* IDENT label + name */}
        <span style={{ fontSize: "0.48rem", letterSpacing: "0.28em", color: MUTED, textShadow: SHADOW }}>
          IDENT
        </span>
        <div
          style={{
            width: 1,
            height: 10,
            background: BORDER_DIM,
          }}
        />
        <span
          style={{
            fontSize: "0.52rem",
            letterSpacing: "0.2em",
            color: FG,
            textShadow: SHADOW,
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={session.user.name}
        >
          {session.user.name.toUpperCase()}
        </span>
        {/* Sign out */}
        <button
          className="account-signout-btn"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          title="Sign out"
          style={{
            fontSize: "0.44rem",
            letterSpacing: "0.22em",
            color: MUTED,
            padding: "2px 6px",
            borderRadius: 2,
            opacity: signingOut ? 0.4 : 0.6,
            border: `1px solid ${BORDER_DIM}`,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {signingOut ? <AccountSpinner /> : null}
          SIGN OUT
        </button>
      </div>
    );
  }

  // ── Signed out ─────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative" }}>
      {/* Collapsed affordance */}
      {!expanded && (
        <button
          className="account-toggle-btn"
          onClick={() => setExpanded(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 8px",
            border: `1px solid ${BORDER_DIM}`,
            borderRadius: 2,
            color: MUTED,
            opacity: 0.7,
            fontSize: "0.48rem",
            letterSpacing: "0.28em",
          }}
        >
          {/* Dim dot — not authenticated */}
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              border: `1px solid rgba(215,226,230,0.25)`,
              flexShrink: 0,
            }}
          />
          SIGN IN TO SAVE STATS
        </button>
      )}

      {/* Expanded auth form — absolutely positioned below the toggle */}
      {expanded && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 280,
            background: "linear-gradient(145deg, rgba(10,16,22,0.98) 0%, rgba(5,7,10,0.98) 100%)",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            boxShadow: `0 0 0 1px rgba(5,7,10,0.5), 0 16px 48px rgba(0,0,0,0.9), 0 0 28px rgba(76,201,240,0.04)`,
            backdropFilter: "blur(16px)",
            zIndex: 100,
            animation: "account-expand 0.2s ease-out forwards",
            overflow: "hidden",
          }}
        >
          {/* Corner brackets */}
          <PanelCorner pos="tl" />
          <PanelCorner pos="tr" />
          <PanelCorner pos="bl" />
          <PanelCorner pos="br" />

          {/* Header row */}
          <div
            style={{
              padding: "12px 16px 10px",
              borderBottom: `1px solid rgba(76,201,240,0.08)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  border: `1px solid rgba(76,201,240,0.5)`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "0.52rem", letterSpacing: "0.35em", color: ACCENT, textShadow: SHADOW }}>
                IDENT
              </span>
            </div>
            <button
              className="account-toggle-btn"
              onClick={() => { setExpanded(false); setAuthError(null); }}
              title="Close"
              style={{
                color: MUTED,
                fontSize: "0.6rem",
                opacity: 0.5,
                padding: "1px 3px",
              }}
            >
              &#x2715;
            </button>
          </div>

          {/* Guest note */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: `1px solid rgba(76,201,240,0.05)`,
              fontSize: "0.5rem",
              letterSpacing: "0.1em",
              color: "rgba(215,226,230,0.32)",
              lineHeight: 1.5,
              textShadow: SHADOW,
            }}
          >
            OPTIONAL — guests play without signing in. Sign in to persist match stats across sessions.
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${BORDER_DIM}`,
            }}
          >
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                className="account-tab"
                onClick={() => handleTabSwitch(t)}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: "0.5rem",
                  letterSpacing: "0.28em",
                  color: tab === t ? ACCENT : MUTED,
                  background: tab === t ? "rgba(76,201,240,0.06)" : "transparent",
                  borderBottom: tab === t ? `1px solid ${ACCENT}` : "1px solid transparent",
                  textTransform: "uppercase",
                }}
              >
                {t === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Form body */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Name field — signup only */}
            {tab === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  htmlFor="account-name"
                  style={{ fontSize: "0.48rem", letterSpacing: "0.3em", color: MUTED, textShadow: SHADOW }}
                >
                  CALL SIGN
                </label>
                <input
                  ref={firstInputRef}
                  id="account-name"
                  className="account-input"
                  type="text"
                  placeholder="your name..."
                  value={name}
                  maxLength={24}
                  disabled={submitting}
                  autoComplete="name"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => { setName(e.target.value); setAuthError(null); }}
                  onKeyDown={handleKeyDown}
                  style={{ padding: "8px 10px", borderRadius: 2 }}
                />
              </div>
            )}

            {/* Email field */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                htmlFor="account-email"
                style={{ fontSize: "0.48rem", letterSpacing: "0.3em", color: MUTED, textShadow: SHADOW }}
              >
                EMAIL
              </label>
              <input
                ref={tab === "signin" ? firstInputRef : undefined}
                id="account-email"
                className="account-input"
                type="email"
                placeholder="operator@domain.com"
                value={email}
                disabled={submitting}
                autoComplete={tab === "signin" ? "email" : "email"}
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                onKeyDown={handleKeyDown}
                style={{ padding: "8px 10px", borderRadius: 2 }}
              />
            </div>

            {/* Password field */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                htmlFor="account-password"
                style={{ fontSize: "0.48rem", letterSpacing: "0.3em", color: MUTED, textShadow: SHADOW }}
              >
                PASSWORD{tab === "signup" ? " — MIN 8" : ""}
              </label>
              <input
                id="account-password"
                className="account-input"
                type="password"
                placeholder={tab === "signup" ? "min 8 characters" : "••••••••"}
                value={password}
                disabled={submitting}
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                onKeyDown={handleKeyDown}
                style={{ padding: "8px 10px", borderRadius: 2 }}
              />
            </div>

            {/* Error banner */}
            {authError && (
              <div
                style={{
                  padding: "7px 10px",
                  background: "rgba(240,76,76,0.07)",
                  border: `1px solid rgba(240,76,76,0.25)`,
                  borderRadius: 2,
                  fontSize: "0.55rem",
                  letterSpacing: "0.08em",
                  color: DANGER,
                  lineHeight: 1.4,
                  textShadow: SHADOW,
                  animation: "account-error-shake 0.3s ease-out",
                }}
              >
                {authError}
              </div>
            )}

            {/* Submit */}
            <button
              className="account-submit-btn"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              style={{
                marginTop: 2,
                padding: "10px 0",
                fontSize: "0.58rem",
                letterSpacing: "0.28em",
                color: submitting ? MUTED : ACCENT,
                background: "rgba(76,201,240,0.07)",
                border: `1px solid rgba(76,201,240,0.25)`,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                textTransform: "uppercase",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {submitting ? (
                <>
                  <AccountSpinner />
                  {tab === "signin" ? "AUTHENTICATING…" : "CREATING ACCOUNT…"}
                </>
              ) : (
                tab === "signin" ? "SIGN IN" : "CREATE ACCOUNT"
              )}
            </button>

            {/* Guest skip note */}
            <button
              className="account-toggle-btn"
              onClick={() => { setExpanded(false); setAuthError(null); }}
              style={{
                fontSize: "0.44rem",
                letterSpacing: "0.2em",
                color: "rgba(215,226,230,0.22)",
                padding: "2px 0",
                textAlign: "center",
                textTransform: "uppercase",
                width: "100%",
              }}
            >
              Continue as guest ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small decorative corner brackets for the auth panel ─────────────────────
function PanelCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const isTop = pos === "tl" || pos === "tr";
  const isLeft = pos === "tl" || pos === "bl";
  const size = 12;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: isTop ? 0 : undefined,
        bottom: isTop ? undefined : 0,
        left: isLeft ? 0 : undefined,
        right: isLeft ? undefined : 0,
        width: size,
        height: size,
        borderTop: isTop ? `1px solid ${ACCENT}` : "none",
        borderBottom: isTop ? "none" : `1px solid ${ACCENT}`,
        borderLeft: isLeft ? `1px solid ${ACCENT}` : "none",
        borderRight: isLeft ? "none" : `1px solid ${ACCENT}`,
        opacity: 0.55,
      }}
    />
  );
}
