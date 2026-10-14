#!/usr/bin/env node
/**
 * 部署后验收：一条命令把线上该有的行为全测一遍（零依赖，只用 fetch）。
 *
 *   node tools/verify-deploy.mjs https://lcr-birthday.asia
 *   node tools/verify-deploy.mjs http://127.0.0.1:8788        # 本地也能跑（本地没有 _headers，会只给提醒）
 *
 * 重点验三件事：
 *   1. 静态资源都在、MIME 对；
 *   2. 密钥路径（中文、带/不带尾斜杠）能打开，返回的是站点外壳而不是 Cloudflare 的错误页；
 *   3. 未知路径返回 200 + 外壳（SPA 回退生效）—— 这一条不通过，整个"密钥即网址"就断了。
 */

import { pathToFileURL } from 'node:url';

import { levels } from '../public/levels.js';
import { buildRoutes, normalizePath, routeSeed } from '../public/shared/levels-utils.js';

const SHELL_MARK = '<template id="tpl-level">';
const CLOUDFLARE_ERROR = /Error 1\d{3}|cloudflare\.com\/[0-9a-z-]+\/error|本网站暂时无法访问/i;
const SPOILER = /BV[0-9A-Za-z]{10}|bilibili/i;

function parseArgs(argv) {
  const base = argv.find((arg) => /^https?:\/\//i.test(arg));
  return { base: base ? base.replace(/\/+$/, '') : null, plain: argv.includes('--plain') };
}

async function probe(url, { expectType } = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'lcr-verify' } });
    const body = await response.text();
    return {
      ok: true,
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      robots: response.headers.get('x-robots-tag') ?? '',
      server: response.headers.get('server') ?? '',
      body,
      ms: Date.now() - started,
      expectType,
    };
  } catch (error) {
    return { ok: false, error: error.message, ms: Date.now() - started };
  }
}

export async function verify(base) {
  const routes = buildRoutes(levels);
  const keyRoute = routes[1] ? normalizePath(routes[1]) : null;
  const encodedKey = routes[1] ?? null;
  const results = [];
  const push = (name, passed, detail, level = 'error') => results.push({ name, passed, detail, level });

  // 1) 外壳与静态资源
  const shell = await probe(`${base}/`);
  push('/ 返回站点外壳', shell.ok && shell.status === 200 && shell.body.includes(SHELL_MARK),
    shell.ok ? `HTTP ${shell.status} ${shell.type} ${shell.ms}ms${shell.body.includes(SHELL_MARK) ? '' : '（内容不是站点外壳）'}` : `请求失败：${shell.error}`);
  push('/ 不是 Cloudflare 错误页', shell.ok && !CLOUDFLARE_ERROR.test(shell.body),
    shell.ok ? (CLOUDFLARE_ERROR.test(shell.body) ? '返回了 Cloudflare 错误页' : '正常') : '无法判断');

  for (const [path, type] of [['/app.js', 'javascript'], ['/levels.js', 'javascript'], ['/styles.css', 'css'], ['/shared/levels-utils.js', 'javascript'], ['/favicon.svg', 'svg'], ['/robots.txt', 'text']]) {
    const res = await probe(`${base}${path}`);
    push(`${path} 可访问`, res.ok && res.status === 200 && res.type.includes(type),
      res.ok ? `HTTP ${res.status} ${res.type}` : `请求失败：${res.error}`);
  }

  // 2) 密钥路径（中文、编码、有无尾斜杠）
  if (encodedKey) {
    const trailing = await probe(`${base}${encodedKey}`);
    push(`密钥路径 ${keyRoute} 可打开`, trailing.ok && trailing.status === 200 && trailing.body.includes(SHELL_MARK),
      trailing.ok ? `HTTP ${trailing.status} ${trailing.ms}ms` : `请求失败：${trailing.error}`);

    const noSlash = await probe(`${base}${encodedKey.replace(/\/$/, '')}`);
    push('密钥路径去掉尾斜杠也能打开', noSlash.ok && noSlash.status === 200 && noSlash.body.includes(SHELL_MARK),
      noSlash.ok ? `HTTP ${noSlash.status} ${noSlash.ms}ms` : `请求失败：${noSlash.error}`);

    // 3) 未知路径必须回退到外壳，而不是 404
    const miss = await probe(`${base}/lcr-spa-fallback-check/`);
    push('未知路径返回 200 + 外壳（SPA 回退）', miss.ok && miss.status === 200 && miss.body.includes(SHELL_MARK),
      miss.ok ? `HTTP ${miss.status}${miss.status !== 200 ? '（应为 200，说明回退没开）' : ''}` : `请求失败：${miss.error}`);
    if (miss.ok && shell.ok) {
      push('未知路径与首页内容一致', miss.body === shell.body, miss.body === shell.body ? '一致' : '不一致（可能是错误页）');
    }
  } else {
    push('第 2 关有密钥路径', false, 'levels[0].answers[0] 是空的');
  }

  // 4) SEO 头与剧透检查
  if (shell.ok) {
    push('响应头带 x-robots-tag: noindex', /noindex/i.test(shell.robots),
      shell.robots ? `x-robots-tag: ${shell.robots}` : '没有这个响应头（本地预览没有 _headers 是正常的）', 'warn');
  }
  const levelsJs = await probe(`${base}/levels.js`);
  if (levelsJs.ok) {
    push('线上题库没有泄露视频号', !SPOILER.test(levelsJs.body),
      SPOILER.test(levelsJs.body) ? '发现 BV 号或视频站字样！' : '干净');
  }

  return { results, shell, keyRoute, routes, hasWarnOnly: results.every((r) => r.passed || r.level === 'warn') };
}

/** 中日韩字符在终端里占两格，算显示宽度才不会把表格对齐搞乱。 */
const isWide = (char) => /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(char);
const displayWidth = (text) => [...text].reduce((sum, char) => sum + (isWide(char) ? 2 : 1), 0);

function report({ results, shell, routes, base }) {
  const column = Math.max(...results.map((r) => displayWidth(r.name))) + 2;
  console.log(`部署验收：${base}`);
  console.log('─'.repeat(64));
  for (const item of results) {
    const mark = item.passed ? '✓' : item.level === 'warn' ? '⚠' : '✗';
    const pad = ' '.repeat(Math.max(0, column - displayWidth(item.name)));
    console.log(`  ${mark} ${item.name}${pad}${item.detail}`);
  }
  console.log('─'.repeat(64));

  const failed = results.filter((r) => !r.passed && r.level !== 'warn');
  const warned = results.filter((r) => !r.passed && r.level === 'warn');
  if (shell?.ok) console.log(`首页响应：HTTP ${shell.status}，${shell.server || '未知 server'}，${shell.ms}ms`);

  if (failed.length > 0) {
    console.log(`结论：${failed.length} 项不通过，先别给寿星发链接。`);
  } else if (warned.length > 0) {
    console.log(`结论：关键项全部通过，${warned.length} 条提醒可以看看。`);
  } else {
    console.log('结论：全部通过。');
  }

  console.log('');
  console.log('给寿星的链接：');
  console.log(`  从第一关开始（通常只发这一条）：${base}/`);
  for (let i = 1; i < routes.length; i += 1) {
    const seed = routeSeed(levels[i - 1]);
    console.log(`  直接跳到第 ${i + 1} 关：${base}/${encodeURIComponent(seed)}/`);
  }
  return failed.length === 0;
}

function main() {
  const { base } = parseArgs(process.argv.slice(2));
  if (!base) {
    console.error('用法：node tools/verify-deploy.mjs https://你的域名');
    process.exit(1);
  }
  verify(base)
    .then((result) => {
      const ok = report({ ...result, base });
      process.exit(ok ? 0 : 1);
    })
    .catch((error) => {
      console.error(`验收脚本出错：${error.message}`);
      process.exit(1);
    });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
