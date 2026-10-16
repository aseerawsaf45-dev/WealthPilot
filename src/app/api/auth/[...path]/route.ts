/**
 * WealthPilot — Neon Auth Route Handler
 * 
 * Proxies auth requests (signin, signup, signout, session, oauth) to Neon Managed Better Auth.
 */

import { auth } from "@/lib/auth/server";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
