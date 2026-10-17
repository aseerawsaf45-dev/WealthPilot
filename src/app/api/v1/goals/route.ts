/**
 * WealthPilot — Savings goals. GET/POST /api/v1/goals
 */

import { authed, parseBody, ok } from '@/server/http';
import { GoalInput } from '@/server/schemas';
import { listGoals, createGoal } from '@/server/repos/planning';

export const GET = authed(async (_request, { userId }) => ok(await listGoals(userId)));

export const POST = authed(async (request, { userId }) => ok(await createGoal(userId, await parseBody(request, GoalInput)), 201));
