import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * Dev-only middleware that persists browser-extracted landmarks to disk so
 * they survive page reloads. Writes under
 * `test-videos/landmarks/.browser-cache/` (gitignored) — committed fixtures
 * are never overwritten.
 *
 * Endpoints:
 *   GET  /api/landmarks/:id   → 200 JSON body, or 404 if no cache entry
 *   POST /api/landmarks/:id   → writes body as `${id}.landmarks.json`
 */
export function landmarkCachePlugin(): Plugin {
  const ID_PATTERN = /^[a-z0-9._-]+$/i;
  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

  return {
    name: 'landmark-cache',
    apply: 'serve',
    configureServer(server) {
      const cacheDir = path.resolve(
        server.config.root,
        '../../test-videos/landmarks/.browser-cache'
      );

      server.middlewares.use('/api/landmarks/', (req, res, next) => {
        const url = req.url ?? '';
        const id = url.split('?')[0].replace(/^\/+/, '');
        if (!id || !ID_PATTERN.test(id)) {
          res.statusCode = 400;
          res.end('invalid id');
          return;
        }
        const file = path.join(cacheDir, `${id}.landmarks.json`);

        if (req.method === 'GET') {
          fs.promises
            .readFile(file, 'utf8')
            .then((data) => {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.end(data);
            })
            .catch(() => {
              res.statusCode = 404;
              res.end();
            });
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          let total = 0;
          let aborted = false;
          req.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BYTES) {
              aborted = true;
              res.statusCode = 413;
              res.end('payload too large');
              req.destroy();
              return;
            }
            chunks.push(chunk);
          });
          req.on('end', async () => {
            if (aborted) return;
            const body = Buffer.concat(chunks).toString('utf8');
            try {
              JSON.parse(body);
            } catch {
              res.statusCode = 400;
              res.end('invalid json');
              return;
            }
            try {
              await fs.promises.mkdir(cacheDir, { recursive: true });
              await fs.promises.writeFile(file, body, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, bytes: body.length }));
            } catch (err) {
              res.statusCode = 500;
              res.end(err instanceof Error ? err.message : 'write failed');
            }
          });
          return;
        }

        next();
      });
    },
  };
}
