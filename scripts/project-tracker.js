#!/usr/bin/env node
/**
 * WealthPilot — Project Memory Status Tracker
 * 
 * Parses PROJECT_MEMORY.md and provides an instant command-line summary
 * of completed features, active milestones, and compliance status.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', 'PROJECT_MEMORY.md');

if (!fs.existsSync(MEMORY_FILE)) {
  console.error('Error: PROJECT_MEMORY.md not found.');
  process.exit(1);
}

const content = fs.readFileSync(MEMORY_FILE, 'utf8');

console.log('\n=============================================================');
console.log('🧭  WealthPilot — Project Implementation & Memory Tracker');
console.log('=============================================================\n');

// Extract Progress Bar
const progressMatch = content.match(/Overall Project Completion:\s*(\[.*?\]\s*\d+%)/);
if (progressMatch) {
  console.log(`📊 Progress: ${progressMatch[1]}\n`);
}

// Extract Completed Feature Count
const completedFeatures = (content.match(/\* \[x\]/g) || []).length;
console.log(`✅ Completed Core Modules: ${completedFeatures} features verified`);

// Extract WIP / Next Tasks
console.log('\n🎯 Next Immediate Tasks:');
const taskRegex = /\| (🔴 High|🟡 Med|🟢 Low) \| \*\*(.*?)\*\* \| (.*?) \| (.*?) \| \*\*(.*?)\*\* \|/g;
let match;
while ((match = taskRegex.exec(content)) !== null) {
  console.log(`   [${match[1]}] ${match[2]}: ${match[3]} (${match[5]})`);
}

// Extract ADRs
const adrs = (content.match(/\* \*\*ADR-\d+:/g) || []).length;
console.log(`\n📐 Active Architectural Decisions (ADRs): ${adrs} recorded`);

console.log('\n💡 To view detailed architecture & free AI specs, refer to:');
console.log('   -> BACKEND_AND_AI_PLAN.md');
console.log('   -> docs/API_AND_MACHINE_LEARNING_SPECIFICATION.md\n');
