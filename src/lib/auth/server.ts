/**
 * WealthPilot — Neon Auth Server Configuration
 * 
 * Powered by Managed Better Auth on Neon Lakebase Postgres.
 * Sessions and users reside in the neon_auth schema on Neon.
 */

import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET || "wealthpilot-neon-auth-cookie-secret-32-chars-long",
  },
});
