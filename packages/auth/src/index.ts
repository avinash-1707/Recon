import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authSchema, getDb } from "@recon/db";

function clientOrigin(): string {
  return process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
}

const isProd = process.env.NODE_ENV === "production";

function build() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (isProd && (!secret || secret.length < 32)) {
    // Fail closed rather than silently signing sessions with Better Auth's
    // guessable dev-fallback secret. The server's try/catch then disables auth.
    throw new Error(
      "BETTER_AUTH_SECRET must be set to a 32+ char value in production",
    );
  }
  if (!secret) {
    console.warn(
      "[auth] BETTER_AUTH_SECRET not set — using Better Auth's insecure dev fallback",
    );
  }
  return betterAuth({
    appName: "Recon",
    database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      // No email provider wired yet — verification is a later add.
      requireEmailVerification: false,
    },
    trustedOrigins: [clientOrigin()],
    advanced: {
      // The web app and this server are different origins, and the session
      // cookie must ride the cross-origin API calls AND the socket handshake.
      // SameSite=None;Secure is required for that; Chrome treats http://localhost
      // as a secure context, so it also works in dev. (useSecureCookies adds the
      // __Secure- prefix / HTTPS enforcement — prod only.)
      defaultCookieAttributes: { sameSite: "none", secure: true },
      useSecureCookies: isProd,
    },
  });
}

export type Auth = ReturnType<typeof build>;

let instance: Auth | null = null;

/**
 * Build (once) and return the Better Auth instance (credentials only — no
 * social providers). Importing this package is side-effect-free; the FIRST
 * getAuth() call constructs the instance and opens the DB pool, so callers gate
 * on `isDbConfigured()` before invoking. Reads BETTER_AUTH_SECRET /
 * BETTER_AUTH_URL from the environment.
 */
export function getAuth(): Auth {
  if (!instance) instance = build();
  return instance;
}

/** Resolve a user id from a raw Cookie header (socket handshake). Null = guest. */
export async function userIdFromCookie(cookie: string): Promise<string | null> {
  try {
    const result = await getAuth().api.getSession({
      headers: new Headers({ cookie }),
    });
    return result?.user?.id ?? null;
  } catch {
    return null;
  }
}
