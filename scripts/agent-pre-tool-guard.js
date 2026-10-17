#!/usr/bin/env node
/**
 * WealthPilot — Agent Lifecycle Hook: PreToolUse Safety Guard
 *
 * Shared by Antigravity (.agents/hooks.json) and Claude Code (.claude/settings.json).
 * Blocks catastrophic shell commands:
 * - Accidental database drops or irreversible deletions
 * - Dumping real secrets from .env into the agent transcript
 */

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    setTimeout(() => resolve({}), 2000);
  });
}

const BLOCKED = [
  [/drop\s+(database|schema|table)/, 'Destructive database drop command blocked to prevent irreversible loss of ledger records.'],
  [/prisma\s+migrate\s+reset|--force-reset|--accept-data-loss/, 'Prisma command that wipes data blocked. Test destructive migrations on a Neon branch instead.'],
  [/rm\s+-rf\s+(\/|~|\.)(\s|$)/, 'Recursive delete of a root/home/project directory blocked.'],
  [/(cat|type|get-content|more|less|head|tail)\s+["']?[^\s"']*\.env(\.local)?["']?(\s|$)/, 'Reading .env would copy real secrets into the agent transcript. Use .env.example for key names.'],
];

async function main() {
  const context = await readStdin();
  // Claude Code sends tool_input.command; Antigravity sends toolCall.args.CommandLine.
  const isClaude = Boolean(context.tool_input);
  const command = String(
    (isClaude ? context.tool_input.command : (context.toolCall || {}).args?.CommandLine) || ''
  ).toLowerCase();

  const hit = BLOCKED.find(([pattern]) => pattern.test(command));
  if (!hit) {
    // Claude Code: no output = normal permission flow. Antigravity expects an explicit allow.
    if (!isClaude) process.stdout.write(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  const reason = `FinTech Compliance Safety Guard: ${hit[1]}`;
  const output = isClaude
    ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }
    : { decision: 'deny', reason };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => process.exit(0));
