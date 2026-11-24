// Servidor local para testar o app: node serve.js [porta]
// - Serve os arquivos estáticos (service workers exigem https ou localhost).
// - Roda as funções de /api como a Vercel faria, lendo variáveis de .env.local.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 5510;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const PRIVATE = ['scripts', 'api', 'node_modules', '.git'];

// Carrega .env.local (CHAVE=valor por linha), sem sobrescrever o ambiente.
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
} catch (e) { /* sem .env.local */ }

async function handleApi(name, req, res) {
  if (!/^[a-z-]+$/.test(name)) { res.writeHead(404).end(); return; }
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Não encontrado"}'); return; }
  try {
    await require(file)(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"Erro no servidor"}');
  }
}

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { pathname = '/'; }

  if (pathname.startsWith('/api/')) { handleApi(pathname.slice(5), req, res); return; }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(ROOT, path.normalize(pathname));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || PRIVATE.includes(rel.split(path.sep)[0]) || path.basename(rel).startsWith('.env')) {
    res.writeHead(403).end('Proibido');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Tarefas em http://localhost:${PORT}`));
