"use client";

import { createAuthClient } from "better-auth/react";
import { SERVER_URL } from "@/game/net/socket";

/**
 * Better Auth browser client, pointed at the @recon/server auth handler
 * (`${SERVER_URL}/api/auth`). credentials:"include" so the session cookie is
 * sent cross-origin and is then available on the socket handshake.
 */
export const authClient = createAuthClient({
  baseURL: SERVER_URL,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
