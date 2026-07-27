"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Imported only by the login page, so the client bundle for
 * every public page stays free of it.
 */
export const authClient = createAuthClient();
export const { signIn, signOut, useSession } = authClient;
