#!/usr/bin/env node
// Lighthouse audit — Phase 1 audit gap closure
// Usage: node scripts/audit-gaps/lighthouse-check.mjs --url=http://localhost:3000

const { execSync } = require('child_process');
const url = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3000';

console.log(`[Lighthouse] Running audit against ${url}...`);

try {
  // Try npx lighthouse first, fall back to installed module
  const output = execSync(
    `npx lighthouse ${url} --output=json --output-path=.lighthouse-report.json --chrome-flags="--headless"` +
    ` || node -e "const lighthouse = require('lighthouse'); lighthouse('${url}', {output:'json',port:9222}).then(r=>console.log('Lighthouse ran:', r))"`,
    { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }
  );
  console.log('[Lighthouse] Audit completed. Check .lighthouse-report.json');
} catch (e) {
  console.error('[Lighthouse] Audit failed — ensure `lighthouse` package is installed (`npm i lighthouse`) and a server is running at the URL.');
  console.error(e.message);
  process.exit(1);
}
