#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const targetRoots = [
  path.join(rootDir, 'apps/parakeet/src/app'),
  path.join(rootDir, 'apps/parakeet/src/components'),
  path.join(rootDir, 'apps/parakeet/src/store'),
  path.join(rootDir, 'apps/parakeet/src/utils'),
];

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const importMatches = content.matchAll(/(?:from\s+|import\s+)['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const source = match[1];

      // App shell must not import infrastructure clients directly.
      if (
        source.includes('/platform/supabase') ||
        source.includes('/network/supabase-client') ||
        source.includes('/lib/supabase')
      ) {
        violations.push({ file: fullPath, reason: `forbidden infra import: ${source}` });
      }

      // UI/shell must not import legacy architecture paths.
      if (
        source.includes('/lib/') ||
        source.includes('/services/') ||
        source.includes('/data/') ||
        source.includes('/hooks/') ||
        source.includes('/queries/') ||
        source.includes('/network/')
      ) {
        violations.push({ file: fullPath, reason: `legacy architecture import: ${source}` });
      }

      // App shell may import module public APIs, not deep internals.
      const modulePathMatch = source.match(/modules\/([^/]+)\/(.+)$/);
      if (modulePathMatch) {
        violations.push({
          file: fullPath,
          reason: `deep module import: ${source} (use modules/${modulePathMatch[1]} public API)`,
        });
      }
    }
  }
}

for (const root of targetRoots) {
  walk(root);
}

if (violations.length > 0) {
  console.error('Module boundary check failed:');
  for (const v of violations) {
    console.error(`- ${path.relative(rootDir, v.file)} :: ${v.reason}`);
  }
  process.exit(1);
}

console.log('Module boundary check passed.');
