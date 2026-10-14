#!/usr/bin/env node
/**
 * 本地预览用的静态服务器（零依赖），行为刻意对齐 Cloudflare Pages：
 *   1) 命中真实文件就返回文件；
 *   2) 没命中就返回 public/index.html（Pages 在没有顶层 404.html 时的 SPA 回退）。
 * 这样 /狂奔在沙漠中暴雨下 这类"密钥路径"在本地和线上表现一致。
 *
 *   node tools/serve.mjs            # http://127.0.0.1:8788
 *   node tools/serve.mjs --port 9000
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../public/', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function parsePort(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') return Number(argv[i + 1]);
    if (argv[i].startsWith('--port=')) return Number(argv[i].slice('--port='.length));
  }
  return Number(process.env.PORT ?? 8788);
}

function decodePathSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function findFile(pathname) {
  const relative = pathname.replace(/^\/+/, '');
  // Pages 会消费 _headers / _redirects 而不是把它们当静态文件发出去，本地也照做
  if (/^_(headers|redirects)$/i.test(relative)) return { file: null };
  const candidate = resolve(ROOT, relative);
  // 防目录穿越：任何解析结果都必须落在 public/ 里
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return { file: null, forbidden: true };
  try {
    const info = await stat(candidate);
    if (info.isFile()) return { file: candidate };
    if (info.isDirectory()) {
      const indexFile = join(candidate, 'index.html');
      const indexInfo = await stat(indexFile).catch(() => null);
      if (indexInfo?.isFile()) return { file: indexFile };
    }
  } catch {
    /* 未命中，走 SPA 回退 */
  }
  return { file: null };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const pathname = decodePathSafe(url.pathname);
  const found = await findFile(pathname);

  if (found.forbidden) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('403');
    console.log(`${req.method} ${url.pathname} → 403（越界路径）`);
    return;
  }

  const fallback = join(ROOT, 'index.html');
  const target = found.file ?? fallback;
  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
    const how = found.file ? extname(target) || 'file' : 'index.html（SPA 回退）';
    console.log(`${req.method} ${url.pathname} → 200 ${how}`);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 ${error.message}`);
    console.log(`${req.method} ${url.pathname} → 500 ${error.message}`);
  }
});

const port = parsePort(process.argv.slice(2));
server.listen(port, '127.0.0.1', () => {
  console.log(`本地预览：http://127.0.0.1:${port}/`);
  console.log(`静态目录：${ROOT}`);
  console.log('行为对齐 Cloudflare Pages：没命中的路径都会回退到 index.html。按 Ctrl+C 结束。');
});
