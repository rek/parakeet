#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const targetRoots = [
  path.join(rootDir, 'apps/parakeet/src/app'),
  path.join(rootDir, 'apps/parakeet/src/hooks'),
  path.join(rootDir, 'apps/parakeet/src/components'),
];

const importPattern =
  /import\s+[^'"]*\{\s*supabase\s*\}[^'"]*from\s*['"][^'"]*\/lib\/supabase['"]/g;

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (importPattern.test(content)) {
      violations.push(path.relative(rootDir, fullPath));
    }
  }
}

for (const root of targetRoots) {
  walk(root);
}

if (violations.length > 0) {
  console.error('Found forbidden `supabase` imports in UI layers:');
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('Supabase UI boundary check passed.');
