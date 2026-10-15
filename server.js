// Tiny zero-dependency static file server for local play: `npm start`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8090;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wad': 'application/octet-stream',
};
// Only the game itself is served. wads/ is local-only (git-ignored) and lets the
// game auto-load a WAD you keep next to it.
const ALLOWED = ['/src/', '/vendor/', '/wads/'];

export function resolveRequestPath(rawUrl) {
  const url = new URL(rawUrl, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  if (pathname !== '/index.html' && !ALLOWED.some((p) => pathname.startsWith(p))) return null;
  if (pathname.split('/').some((seg) => seg.startsWith('.'))) return null;
  const filePath = resolve(join(ROOT, normalize(pathname)));
  return filePath.startsWith(ROOT + sep) ? filePath : null;
}

const server = createServer(async (req, res) => {
  let filePath;
  try {
    filePath = resolveRequestPath(req.url);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      res.writeHead(404).end('Not found');
    } else {
      console.error(`Failed to serve ${filePath}:`, err);
      res.writeHead(500).end('Server error');
    }
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`DoomDungeons running at http://localhost:${PORT}`));
}
