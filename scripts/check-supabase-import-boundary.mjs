#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcRoot = path.join(rootDir, 'apps/parakeet/src');

const allowedDirPrefixes = [
  'apps/parakeet/src/lib/',
  'apps/parakeet/src/data/',
  'apps/parakeet/src/network/',
];

const importPattern =
  /import\s+[^'"]*\{\s*supabase\s*\}[^'"]*from\s*['"](?:(?:\.\.\/)+|(?:\.\/)+).*lib\/supabase['"]/g;

const violations = [];

function walk(dir) {
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
    if (!importPattern.test(content)) continue;

    const relativePath = path.relative(rootDir, fullPath).replaceAll('\\', '/');
    const allowed = allowedDirPrefixes.some((prefix) => relativePath.startsWith(prefix));
    if (!allowed) violations.push(relativePath);
  }
}

walk(srcRoot);

if (violations.length > 0) {
  console.error('Found forbidden `lib/supabase` imports outside data/network/lib:');
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('Supabase import boundary check passed.');
