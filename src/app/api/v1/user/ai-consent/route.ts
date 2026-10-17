/**
 * WealthPilot — AI consent (opt-in, versioned). POST grants { providers }, DELETE revokes.
 */

import { authed, parseBody, ok } from '@/server/http';
import { AiConsentInput } from '@/server/schemas';
import { grantAiConsent, revokeAiConsent } from '@/server/repos/user';

export const POST = authed(async (request, { userId }) => {
  const { providers } = await parseBody(request, AiConsentInput);
  return ok(await grantAiConsent(userId, providers));
});

export const DELETE = authed(async (_request, { userId }) => ok(await revokeAiConsent(userId)));
