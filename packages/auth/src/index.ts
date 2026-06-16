import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authSchema, getDb } from "@recon/db";

function clientOrigin(): string {
  return process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
}

const isProd = process.env.NODE_ENV === "production";

function build() {
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
      // The web app and this server are different origins. In production
      // (cross-site) cookies must be SameSite=None; Secure to be sent on the
      // socket handshake + API calls. Dev (localhost:port) is same-site → lax.
      defaultCookieAttributes: isProd
        ? { sameSite: "none", secure: true }
        : undefined,
      useSecureCookies: isProd,
    },
  });
}

export type Auth = ReturnType<typeof build>;

let instance: Auth | null = null;

/**
 * Lazily build the Better Auth instance (credentials only — no social
 * providers). Lazy so importing this package never opens the DB; callers gate
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
