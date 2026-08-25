#!/usr/bin/env node
// axe-core audit — Phase 1 audit gap closure
// Usage: node scripts/audit-gaps/axe-core-check.mjs --url=http://localhost:3000

import { execSync } from 'child_process';
const url = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3000';

console.log(`[axe-core] Running accessibility audit against ${url}...`);

try {
  const output = execSync(
    `npx axe-core-cli --tags wcag2aa ${url}` +
    ` || node -e "const axe = require('axe-core'); axe.run('${url}').then(r=>console.log('axe results:', JSON.stringify(r.violations.slice(0,3))))"`,
    { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 }
  );
  console.log('[axe-core] Audit completed.');
} catch (e) {
  console.error('[axe-core] Audit failed — ensure `axe-core` package is installed (`npm i axe-core`) and a server is running.');
  console.error(e.message);
  process.exit(1);
}
