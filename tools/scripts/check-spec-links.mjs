#!/usr/bin/env node

/**
 * Spec ↔ code bi-directional link checker.
 *
 * Enforces docs/guide/spec-linking.md:
 *   - Spec files (docs/features/*\/spec-*.md) reference code via "→ path[:symbol]"
 *     lines under ticked tasks. Every referenced path must exist. If :symbol is
 *     given and the file is .ts/.tsx, the symbol should appear in the file.
 *   - Code files (apps/parakeet/src, packages/training-engine/src) may declare
 *     "// @spec <path-to-spec.md>" at the top. Every referenced spec must
 *     exist.
 *
 * Modes:
 *   default: advisory — prints orphans, exits 0
 *   --strict: exit 1 on any orphan
 *
 * Categories reported:
 *   [spec→code] dangling path     spec points at missing file
 *   [spec→code] dangling symbol   file exists, symbol not found (warn only)
 *   [code→spec] dangling spec     code points at missing spec
 *   [coverage]  unlinked module   module has no @spec headers (advisory)
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const strict = process.argv.includes('--strict');

const SPEC_GLOB_DIRS = [path.join(rootDir, 'docs/features')];
const CODE_ROOTS = [
  path.join(rootDir, 'apps/parakeet/src'),
  path.join(rootDir, 'packages/training-engine/src'),
  path.join(rootDir, 'apps/dashboard/src'),
];

const SPEC_ROOT_REL = 'docs/features';

const specToCodeIssues = [];
const codeToSpecIssues = [];
const coverageIssues = [];

function walk(dir, accept) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...walk(p, accept));
    } else if (entry.isFile() && accept(p)) {
      out.push(p);
    }
  }
  return out;
}

function readLines(p) {
  return fs.readFileSync(p, 'utf8').split('\n');
}

function resolveCodeRef(ref) {
  // ref examples:
  //   modules/jit/application/foo.ts
  //   modules/jit/application/foo.ts:runJIT
  //   packages/training-engine/src/foo.ts
  //   apps/dashboard/src/bar.tsx
  const [rawPath, symbol] = ref.split(':');
  const clean = rawPath.trim().replace(/^\/+|\/+$/g, '');
  const candidates = [
    path.join(rootDir, clean),
    path.join(rootDir, 'apps/parakeet/src', clean),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return { filePath: c, symbol: symbol?.trim() };
    }
  }
  return { filePath: null, symbol: symbol?.trim(), tried: candidates };
}

// ---- spec → code ----

const specFiles = walk(SPEC_GLOB_DIRS[0], (p) =>
  /\/spec-[^/]+\.md$/.test(p) && !p.includes('/_TEMPLATE/'),
);

const PATH_EXT = /\.(ts|tsx|js|jsx|mjs|md|sql|json|toml)$/;

for (const spec of specFiles) {
  const specRel = path.relative(rootDir, spec);
  const lines = readLines(spec);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Match link-arrow lines: indented bullet starting with → then a path-like ref.
    // Ref must: be the only token after →, contain '/', end with known extension
    // (optionally followed by :symbol). Excludes narrative "A → B" flows.
    const m = line.match(/^\s*(?:[-*]\s+)?→\s+`?([^\s`]+)`?\s*$/);
    if (!m) continue;
    const ref = m[1];
    const pathPart = ref.split(':')[0];
    if (!pathPart.includes('/') || !PATH_EXT.test(pathPart)) continue;
    const { filePath, symbol } = resolveCodeRef(ref);
    if (!filePath) {
      specToCodeIssues.push({
        kind: 'dangling path',
        spec: specRel,
        line: i + 1,
        ref,
      });
      continue;
    }
    if (symbol && /\.(ts|tsx|js|jsx|mjs)$/.test(filePath)) {
      const src = fs.readFileSync(filePath, 'utf8');
      const symbolRegex = new RegExp(
        `\\b${symbol.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`,
      );
      if (!symbolRegex.test(src)) {
        specToCodeIssues.push({
          kind: 'dangling symbol',
          spec: specRel,
          line: i + 1,
          ref,
          warn: true,
        });
      }
    }
  }
}

// ---- code → spec ----

const codeFiles = [];
for (const root of CODE_ROOTS) {
  codeFiles.push(
    ...walk(root, (p) => /\.(ts|tsx|mjs)$/.test(p) && !p.endsWith('.d.ts')),
  );
}

const moduleCoverage = new Map(); // module name -> { files: 0, linked: 0 }

for (const file of codeFiles) {
  const rel = path.relative(rootDir, file);
  const moduleMatch = rel.match(/apps\/parakeet\/src\/modules\/([^/]+)\//);
  if (moduleMatch) {
    const mod = moduleMatch[1];
    if (!moduleCoverage.has(mod)) moduleCoverage.set(mod, { files: 0, linked: 0 });
    moduleCoverage.get(mod).files++;
  }

  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 10);
  let hasSpec = false;
  for (const line of head) {
    const m = line.match(/\/\/\s*@spec\s+(\S+)/);
    if (!m) continue;
    hasSpec = true;
    const specPath = m[1].trim();
    if (!specPath.startsWith(SPEC_ROOT_REL)) {
      codeToSpecIssues.push({
        kind: 'bad spec root',
        file: rel,
        ref: specPath,
      });
      continue;
    }
    const abs = path.join(rootDir, specPath);
    if (!fs.existsSync(abs)) {
      codeToSpecIssues.push({
        kind: 'dangling spec',
        file: rel,
        ref: specPath,
      });
    }
  }
  if (moduleMatch && hasSpec) {
    moduleCoverage.get(moduleMatch[1]).linked++;
  }
}

for (const [mod, { files, linked }] of moduleCoverage) {
  if (linked === 0 && files > 0) {
    coverageIssues.push({ module: mod, files });
  }
}

// ---- report ----

function print(title, items, formatter) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}):`);
  for (const it of items) console.log('  ' + formatter(it));
}

print('[spec→code] issues', specToCodeIssues, (it) =>
  `${it.spec}:${it.line}  ${it.kind}: ${it.ref}${it.warn ? '  (warn)' : ''}`,
);
print('[code→spec] issues', codeToSpecIssues, (it) =>
  `${it.file}  ${it.kind}: ${it.ref}`,
);
print('[coverage] modules with zero @spec headers', coverageIssues, (it) =>
  `${it.module}  (${it.files} files)`,
);

const hardErrors =
  specToCodeIssues.filter((i) => !i.warn).length +
  codeToSpecIssues.length;

console.log(
  `\nsummary: ${specToCodeIssues.length} spec→code, ${codeToSpecIssues.length} code→spec, ${coverageIssues.length}/${moduleCoverage.size} modules unlinked`,
);

if (strict && hardErrors > 0) {
  console.error(`\nFAIL (strict): ${hardErrors} hard errors`);
  process.exit(1);
}
