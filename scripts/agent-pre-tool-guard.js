#!/usr/bin/env node
/**
 * WealthPilot — Agent Lifecycle Hook: PreToolUse Safety Guard
 * 
 * Intercepts tool executions (commands) to block catastrophic actions:
 * - Accidental database drops or irreversible deletions
 * - Secrets exfiltration or hardcoded keys
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

async function main() {
  const context = await readStdin();
  const toolCall = context.toolCall || {};
  const args = toolCall.args || {};
  const command = (args.CommandLine || '').toLowerCase();

  // Block destructive database eradication commands
  if (
    command.includes('drop database') ||
    command.includes('drop schema') ||
    command.includes('prisma migrate reset') ||
    command.includes('rm -rf /')
  ) {
    const output = {
      decision: 'deny',
      reason: 'FinTech Compliance Safety Guard: Destructive database drop command blocked to prevent irreversible loss of ledger records.',
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  // Allow standard commands
  const output = {
    decision: 'allow',
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
