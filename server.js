// 의존성 없는 로컬 서버: 정적 파일 제공 + 넥슨 Open API 프록시.
// 실행: node server.js  →  http://localhost:8787
// API 키는 .env 파일의 NEXON_API_KEY=... 또는 환경변수로 넣는다. (브라우저에 노출되지 않음)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const NEXON_BASE = 'https://open.api.nexon.com/maplestory/v1';

function loadDotEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ proxy: true, hasKey: Boolean(process.env.NEXON_API_KEY) }));
  }

  if (url.pathname.startsWith('/api/nexon/')) {
    const key = req.headers['x-nxopen-api-key'] || process.env.NEXON_API_KEY;
    if (!key) {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'API 키가 없습니다. .env에 NEXON_API_KEY를 넣거나 화면에서 입력하세요.' } }));
    }
    const target = NEXON_BASE + url.pathname.slice('/api/nexon'.length) + url.search;
    try {
      const r = await fetch(target, { headers: { 'x-nxopen-api-key': key } });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' });
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: `넥슨 서버에 연결하지 못했습니다: ${e.message}` } }));
    }
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const file = join(ROOT, rel || 'index.html');
  if (!file.startsWith(ROOT) || rel.split(/[/\\]/).some((part) => part.startsWith('.'))) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`메이플 도구: http://localhost:${PORT}`));
