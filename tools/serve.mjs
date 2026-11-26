// Mini-Webserver zum lokalen Testen: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const port = +process.argv[2] || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  try { const data = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(data); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`http://localhost:${port}`));
