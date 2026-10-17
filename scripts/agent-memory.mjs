#!/usr/bin/env node
/**
 * WealthPilot — Agent-agnostic memory hook.
 *
 * Memory lives in git-tracked plain files so every agent (Claude Code, Antigravity,
 * Codex, Cursor, a human) reads and writes the same thing:
 *   PROJECT_MEMORY.md      — curated state, between the agent-context markers
 *   .agents/memory/log.md  — append-only work log, newest last
 *
 * Usage:
 *   node scripts/agent-memory.mjs start                 print context (SessionStart hook)
 *   node scripts/agent-memory.mjs log <agent> <text…>   append a log entry
 *   node scripts/agent-memory.mjs stop                  Stop hook: ask once for a log entry
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMORY = path.join(ROOT, 'PROJECT_MEMORY.md');
const LOG = path.join(ROOT, '.agents', 'memory', 'log.md');
const LOG_REL = '.agents/memory/log.md';
const TRACKED = /^(src|prisma|scripts|docs)\//;

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const changedFiles = () =>
  git('status --porcelain -uall') // -uall: list untracked files, not just their new folder
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ''));

function curatedContext() {
  const text = fs.existsSync(MEMORY) ? fs.readFileSync(MEMORY, 'utf8') : '';
  const match = text.match(/<!-- agent-context:start -->([\s\S]*?)<!-- agent-context:end -->/);
  return (match ? match[1] : text.split('\n').slice(0, 40).join('\n')).trim();
}

function recentLog(n = 12) {
  if (!fs.existsSync(LOG)) return '(empty)';
  const entries = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.startsWith('- '));
  return entries.slice(-n).join('\n') || '(empty)';
}

function start() {
  const branch = git('rev-parse --abbrev-ref HEAD').trim() || 'unknown';
  const dirty = changedFiles().length;
  process.stdout.write(
    [
      '## WealthPilot agent memory (auto-loaded)',
      `Branch: ${branch} · uncommitted files: ${dirty}`,
      '',
      curatedContext(),
      '',
      '### Recent work log (.agents/memory/log.md)',
      recentLog(),
      '',
      'Before finishing a task that changed code, run:',
      '  node scripts/agent-memory.mjs log <your-agent-name> "<what changed, what is next>"',
      'Update PROJECT_MEMORY.md (between the agent-context markers) only when status or a decision changes.',
      '',
    ].join('\n')
  );
}

function log(agent, words) {
  const text = words.join(' ').replace(/\s+/g, ' ').trim();
  if (!agent || !text) {
    console.error('usage: node scripts/agent-memory.mjs log <agent> <text…>');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, '# Agent work log (append-only, newest last)\n\n');
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(LOG, `- ${date} [${agent}] ${text}\n`);
  console.log(`logged to ${LOG_REL}`);
}

async function stop() {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {}
  // stop_hook_active means we already asked once this turn; never loop.
  if (input.stop_hook_active) return;
  const files = changedFiles();
  const codeChanged = files.some((f) => TRACKED.test(f));
  const logged = files.includes(LOG_REL);
  if (codeChanged && !logged) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          'Code changed but the shared agent memory was not updated. Run `node scripts/agent-memory.mjs log claude-code "<what changed, what is next>"` (and update PROJECT_MEMORY.md if a status or decision changed), then finish.',
      })
    );
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'start') start();
else if (cmd === 'log') log(rest[0], rest.slice(1));
else if (cmd === 'stop') await stop();
else {
  console.error('usage: agent-memory.mjs start | log <agent> <text…> | stop');
  process.exit(1);
}
