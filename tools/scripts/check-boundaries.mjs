#!/usr/bin/env node

/**
 * Unified boundary enforcement for the Parakeet monorepo.
 *
 * Rules:
 * 1. Cross-module deep imports: @modules/<X>/<subpath> from outside module <X> is forbidden
 * 2. Platform isolation: platform/ must not import from @modules/*
 * 3. Shared isolation: shared/ must not import from @modules/* or @platform/*
 * 4. App shell: app/ and components/ must not import @platform/supabase directly
 * 5. No legacy paths: no imports from removed top-level dirs (lib/, services/, queries/)
 * 6. Circular module dependencies: detects cycles in the module dependency graph
 *
 * Same-module internal imports are always allowed.
 * Dynamic import() of module barrel APIs (e.g., import('@modules/jit')) is allowed.
 * Type-only imports (`import type`) are exempt from layer isolation rules (2, 3)
 * since they are erased at compile time and create no runtime coupling.
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcRoot = path.join(rootDir, 'apps/parakeet/src');

const violations = [];
// Module dependency graph: module -> Map<module, 'static'|'dynamic'> (for cycle detection)
// A static edge means at least one static import exists; dynamic means only dynamic imports.
const moduleGraph = new Map();

// Determine which module a file belongs to (null if not in a module)
function getOwningModule(filePath) {
  const rel = path.relative(srcRoot, filePath).replaceAll('\\', '/');
  const match = rel.match(/^modules\/([^/]+)\//);
  return match ? match[1] : null;
}

// Determine which layer a file belongs to
function getLayer(filePath) {
  const rel = path.relative(srcRoot, filePath).replaceAll('\\', '/');
  if (rel.startsWith('app/') || rel.startsWith('components/')) return 'shell';
  if (rel.startsWith('platform/')) return 'platform';
  if (rel.startsWith('shared/')) return 'shared';
  if (rel.startsWith('modules/')) return 'module';
  return 'other';
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
    checkFile(fullPath);
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const layer = getLayer(filePath);
  const owningModule = getOwningModule(filePath);
  const relPath = path.relative(rootDir, filePath).replaceAll('\\', '/');

  // Match `from '...'` and dynamic `import('...')` patterns
  const importRegex =
    /(?:from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const source = match[1] || match[2];

    // Determine if this is a type-only import by scanning backward for `import type`
    let isTypeOnly = false;
    if (match[1]) {
      // This is a `from '...'` match — find the corresponding `import` keyword
      const before = content.slice(Math.max(0, match.index - 500), match.index);
      const importKeyword = before.match(/import\s+(type)\s+/s);
      if (importKeyword) {
        // Ensure no other `from` between the `import type` and this `from`
        const afterImportType =
          before.slice(before.lastIndexOf(importKeyword[0]));
        if (!afterImportType.includes("from '") && !afterImportType.includes('from "')) {
          isTypeOnly = true;
        }
      }
    }

    // Rule 1: Cross-module deep imports
    const moduleDeep = source.match(/^@modules\/([^/]+)\/(.+)$/);
    if (moduleDeep) {
      const targetModule = moduleDeep[1];
      // Same-module internal imports are fine
      if (targetModule !== owningModule) {
        violations.push({
          file: relPath,
          reason: `cross-module deep import: ${source} (use @modules/${targetModule})`,
        });
      }
    }

    // Track module-to-module edges for cycle detection
    const moduleBarrel = source.match(/^@modules\/([^/]+)$/);
    const moduleAny = moduleDeep || moduleBarrel;
    if (moduleAny && owningModule) {
      const targetModule = moduleAny[1];
      if (targetModule !== owningModule) {
        if (!moduleGraph.has(owningModule)) moduleGraph.set(owningModule, new Map());
        const edges = moduleGraph.get(owningModule);
        const isDynamic = match[2] !== undefined; // match[2] is from import()
        // An edge is 'static' if any static import exists; only 'dynamic' if all are dynamic
        if (!edges.has(targetModule) || !isDynamic) {
          edges.set(targetModule, isDynamic ? (edges.get(targetModule) || 'dynamic') : 'static');
        }
      }
    }

    // Rule 2: Platform isolation (type-only imports exempt — erased at compile time)
    if (layer === 'platform' && source.startsWith('@modules/') && !isTypeOnly) {
      violations.push({
        file: relPath,
        reason: `platform must not import modules: ${source}`,
      });
    }

    // Rule 3: Shared isolation (type-only imports exempt — erased at compile time)
    if (layer === 'shared' && !isTypeOnly) {
      if (source.startsWith('@modules/')) {
        violations.push({
          file: relPath,
          reason: `shared must not import modules: ${source}`,
        });
      }
      if (source.startsWith('@platform/')) {
        violations.push({
          file: relPath,
          reason: `shared must not import platform: ${source}`,
        });
      }
    }

    // Rule 4: App shell must not import supabase client directly
    if (layer === 'shell' && /^@platform\/supabase/.test(source)) {
      violations.push({
        file: relPath,
        reason: `shell must not import supabase directly: ${source}`,
      });
    }

    // Rule 5: No legacy top-level paths
    if (/^\.\.\/(lib|services|queries|data|network|hooks)\//.test(source)) {
      // Only flag if the import resolves to a removed top-level directory
      const resolved = path.resolve(path.dirname(filePath), source);
      const relResolved = path
        .relative(srcRoot, resolved)
        .replaceAll('\\', '/');
      if (/^(lib|services|queries)\//.test(relResolved)) {
        violations.push({
          file: relPath,
          reason: `legacy path import: ${source}`,
        });
      }
    }
  }
}

walk(srcRoot);

// Rule 6: Circular dependency detection via DFS
// Only flag cycles where ALL edges are static imports.
// Dynamic import() is an intentional cycle-breaker.
function detectCycles() {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(node, path, edgeTypes) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cyclePath = path.slice(cycleStart).concat(node);
      const cycleEdges = edgeTypes.slice(cycleStart);
      // Only flag if all edges in the cycle are static
      if (cycleEdges.every((t) => t === 'static')) {
        cycles.push(cyclePath);
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const [dep, edgeType] of moduleGraph.get(node) || []) {
      dfs(dep, [...path], [...edgeTypes, edgeType]);
    }
    stack.delete(node);
  }

  for (const mod of moduleGraph.keys()) {
    dfs(mod, [], []);
  }
  return cycles;
}

const cycles = detectCycles();
for (const cycle of cycles) {
  violations.push({
    file: '(module graph)',
    reason: `circular dependency: ${cycle.join(' -> ')}`,
  });
}

if (violations.length > 0) {
  console.error(`Boundary check failed (${violations.length} violations):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    ${v.reason}\n`);
  }
  process.exit(1);
}

console.log('Boundary check passed.');
