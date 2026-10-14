#!/usr/bin/env node
/**
 * 关卡配置自检（零依赖）。改完 levels.js 就跑一遍：
 *
 *   node tools/check.mjs                # 准备发布时用，有示例内容就直接报错
 *   node tools/check.mjs --allow-demo   # 还没写完内容时用，示例内容降级为提醒
 *
 * 它会检查配置是否自洽，并把整条链路空跑一遍：
 * 用每一关的答案去走，必须正好落到下一关的网址，最后一关必须能到揭晓页。
 * 判定规则和网页用的是同一份代码（public/shared/levels-utils.js），
 * 所以这里通过 = 浏览器里走得通。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  answerMatches,
  buildRoutes,
  matchLevel,
  matchedAnswer,
  normalize,
  normalizePath,
  routeSeed,
} from '../public/shared/levels-utils.js';
import { levels, reveal, site } from '../public/levels.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

/** 这些名字属于站点自己的文件，不能被拿来当密钥网址。 */
const RESERVED_NAMES = [
  'index.html',
  'app.js',
  'levels.js',
  'styles.css',
  'favicon.svg',
  'robots.txt',
  '_headers',
  'shared',
  'assets',
  'images',
  'photos',
];

/** 这些文件是站点能跑起来的最小集合，缺一个都可能在线上白屏。 */
const REQUIRED_FILES = [
  'index.html',
  'app.js',
  'levels.js',
  'styles.css',
  'shared/levels-utils.js',
  'favicon.svg',
  'robots.txt',
  '_headers',
];

const PLACEHOLDER_PATTERN = /【示例|待替换|待你填写|示例关卡|DEMO-/;

const isText = (value) => typeof value === 'string' && value.trim() !== '';

export function check({ allowDemo = false } = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const error = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  // ── 站点文案 ───────────────────────────────────────────────
  for (const key of ['title', 'subtitle', 'wrongAnswer', 'unlocked', 'finalUnlocked', 'notFoundTitle', 'notFoundHint']) {
    if (!isText(site?.[key])) error(`site.${key} 不能为空`);
  }

  // ── 关卡基本字段 ───────────────────────────────────────────
  if (!Array.isArray(levels) || levels.length === 0) {
    error('levels 必须是非空数组');
    return { errors, warnings, notes, routes: [], walk: [] };
  }

  const demoLevels = [];
  levels.forEach((level, index) => {
    const where = `第 ${index + 1} 关`;
    for (const key of ['label', 'face', 'cipherText']) {
      if (!isText(level?.[key])) error(`${where} 缺少 ${key}`);
    }
    if (!Array.isArray(level?.answers) || level.answers.length === 0) {
      error(`${where} 至少要有一个答案（answers）`);
      return;
    }
    level.answers.forEach((answer, answerIndex) => {
      if (!isText(answer)) {
        error(`${where} 的第 ${answerIndex + 1} 个答案不能为空`);
        return;
      }
      if (normalize(answer).length < 2) {
        warn(`${where} 的答案「${answer}」太短，"包含"判定下容易被蹭过去`);
      }
    });

    const seed = routeSeed(level);
    if (isText(seed)) {
      if (seed.includes('/')) error(`${where} 的首个答案里有 “/”，会把网址切断，换一个说法`);
      if (/\s/.test(seed)) error(`${where} 的首个答案里有空格，网址会被编码成 %20，建议去掉`);
      if (/[?#]/.test(seed)) error(`${where} 的首个答案里有 “?” 或 “#”，会破坏网址`);
    }

    if (level.demo) demoLevels.push(index);
    const placeholders = ['face', 'cipherText'].filter((key) => PLACEHOLDER_PATTERN.test(String(level[key] ?? '')));
    if (placeholders.length > 0 && !level.demo) {
      warn(`${where} 的 ${placeholders.join(' / ')} 看起来还是示例内容，但没标 demo`);
    }
    // 答案里出现示例字样，也提醒一下
    if ((level.answers ?? []).some((answer) => PLACEHOLDER_PATTERN.test(String(answer))) && !level.demo) {
      warn(`${where} 的答案看起来还是示例内容，但没标 demo`);
    }
  });

  // ── 网址派生 ───────────────────────────────────────────────
  const routes = buildRoutes(levels);
  routes.forEach((route, index) => {
    if (route === null) {
      error(`第 ${index + 1} 关没有网址：上一关（第 ${index} 关）的首个答案不能为空`);
    }
  });

  const seen = new Map();
  routes.forEach((route, index) => {
    if (route === null) return;
    const normalized = normalizePath(route);
    if (seen.has(normalized)) {
      error(`第 ${index + 1} 关的网址 ${normalized} 和第 ${seen.get(normalized) + 1} 关撞车了，改掉其中一个答案`);
    } else {
      seen.set(normalized, index);
    }
    if (normalized === '/') {
      if (index !== 0) error(`第 ${index + 1} 关的网址是 '/'，只有第 1 关能占这个位置`);
      return;
    }
    const core = normalized.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (RESERVED_NAMES.includes(core)) {
      error(`第 ${index + 1} 关的网址 /${core}/ 和站点自己的文件重名，换一个答案`);
    }
  });

  // 网址之间互相包含 → 回退匹配会有歧义
  for (let i = 1; i < routes.length; i += 1) {
    for (let j = 1; j < routes.length; j += 1) {
      if (i === j || routes[i] === null || routes[j] === null) continue;
      const a = normalizePath(routes[i]);
      const b = normalizePath(routes[j]);
      if (i < j && a !== b && a.includes(b)) {
        warn(`第 ${i + 1} 关的网址 ${a} 里含有第 ${j + 1} 关的网址 ${b}，被截断的链接可能认错门`);
      }
    }
  }

  // ── 揭晓页 ─────────────────────────────────────────────────
  if (!isText(reveal?.title)) error('reveal.title 不能为空');
  if (!Array.isArray(reveal?.paragraphs) || reveal.paragraphs.length === 0) {
    error('reveal.paragraphs 至少要有 1 段');
  } else {
    reveal.paragraphs.forEach((paragraph, index) => {
      if (!isText(paragraph)) error(`reveal.paragraphs 第 ${index + 1} 段是空的`);
    });
  }
  if (reveal?.images !== undefined && !Array.isArray(reveal.images)) {
    error('reveal.images 必须是数组（可以留空数组）');
  }

  // ── 整条链路空跑 ───────────────────────────────────────────
  const walk = [];
  const start = matchLevel(levels, '/');
  if (start?.index !== 0) {
    error('访问 "/" 没能进入第 1 关');
  } else {
    let index = 0;
    while (index < levels.length) {
      const level = levels[index];
      const route = routes[index];
      const current = route === null ? null : normalizePath(route);
      if (index > 0 && matchLevel(levels, route)?.index !== index) {
        error(`直接打开 ${current} 没能进入第 ${index + 1} 关`);
      }

      const seed = routeSeed(level);
      const hit = matchedAnswer(level, `我听到的是「${seed}」`);
      if (hit === null) {
        error(`第 ${index + 1} 关的答案「${seed}」通不过自己的判定`);
      }

      const isLast = index === levels.length - 1;
      if (isLast) {
        walk.push({ from: current, answer: seed, to: `揭晓页（${reveal?.title ?? '?'}）` });
      } else {
        const nextRoute = routes[index + 1];
        const landed = nextRoute === null ? null : matchLevel(levels, nextRoute);
        if (landed?.index !== index + 1) {
          error(`第 ${index + 1} 关的答案「${seed}」没能落到第 ${index + 2} 关`);
        }
        walk.push({ from: current, answer: seed, to: nextRoute === null ? '（没有网址）' : normalizePath(nextRoute) });
      }
      index += 1;
    }
  }

  // 顺带确认反着走不通：拿第 1 关的答案去第 2 关的页面不该通过
  for (let i = 1; i < levels.length; i += 1) {
    const previousSeed = routeSeed(levels[i - 1]);
    if (answerMatches(levels[i], previousSeed)) {
      warn(`第 ${i + 1} 关的答案判定会被上一关的答案「${previousSeed}」直接放行，等于少了一道门`);
    }
  }
  for (const level of levels) {
    if (answerMatches(level, '')) error(`有一关的答案判定会放行空输入，检查 answers 是否含空串`);
  }

  // ── 站点文件 ───────────────────────────────────────────────
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(PUBLIC_DIR, file))) error(`public/${file} 不存在`);
  }
  if (existsSync(join(PUBLIC_DIR, '404.html'))) {
    error('public/404.html 会让 Cloudflare Pages 的 SPA 回退失效，密钥网址会全部变成 404 —— 请删掉它');
  }
  const headersFile = join(PUBLIC_DIR, '_headers');
  if (existsSync(headersFile) && !/noindex/i.test(readFileSync(headersFile, 'utf8'))) {
    warn('public/_headers 里没有 noindex，搜索引擎可能会收录这个站点');
  }

  // ── 示例内容 ───────────────────────────────────────────────
  const pending = [];
  for (const index of demoLevels) {
    const level = levels[index];
    const placeholders = ['face', 'cipherText']
      .filter((key) => PLACEHOLDER_PATTERN.test(String(level[key] ?? '')))
      .concat(PLACEHOLDER_PATTERN.test(routeSeed(level)) ? ['answers'] : []);
    pending.push(`第 ${index + 1} 关：${placeholders.length > 0 ? placeholders.join(' / ') : '标记为 demo'} 还是示例内容`);
  }
  if (Array.isArray(reveal?.paragraphs) && reveal.paragraphs.some((p) => PLACEHOLDER_PATTERN.test(String(p)))) {
    pending.push('生日信正文：还是示例内容');
  }
  if (!isText(reveal?.signature)) {
    notes.push('reveal.signature 是空的，信末不会署名（想留名字就填上）');
  }
  if (pending.length > 0) {
    for (const item of pending) {
      if (allowDemo) warn(item);
      else error(`${item}（临时预览可以加 --allow-demo）`);
    }
  }

  return { errors, warnings, notes, routes, walk, demoLevels, pending };
}

function printReport({ errors, warnings, notes, routes, walk }) {
  const line = '─'.repeat(60);
  console.log('生日解密站 · 配置自检');
  console.log(line);

  console.log('关卡与网址');
  levels.forEach((level, index) => {
    const route = routes[index] === null ? '（没有网址）' : normalizePath(routes[index]);
    const marks = [];
    if (level.demo) marks.push('示例');
    console.log(`  ${index + 1}. ${level.label ?? '（缺 label）'}  →  ${route}${marks.length ? `  [${marks.join('/')}]` : ''}`);
  });

  console.log('揭晓页');
  console.log(`  ${reveal?.title ?? '（缺 title）'}：${reveal?.paragraphs?.length ?? 0} 段，${reveal?.images?.length ?? 0} 张配图`);

  console.log('链路空跑');
  for (const step of walk) {
    console.log(`  ${step.from}  →  输入「${step.answer}」  →  ${step.to}`);
  }

  if (warnings.length > 0) {
    console.log('提醒');
    for (const item of warnings) console.log(`  ⚠ ${item}`);
  }
  if (notes.length > 0) {
    console.log('备注');
    for (const item of notes) console.log(`  · ${item}`);
  }
  if (errors.length > 0) {
    console.log('问题');
    for (const item of errors) console.log(`  ✗ ${item}`);
  }
  console.log(line);
  if (errors.length > 0) {
    console.log(`结论：${errors.length} 个问题必须解决，先别发布。`);
  } else if (warnings.length > 0) {
    console.log(`结论：配置没问题，有 ${warnings.length} 条提醒可以看看。`);
  } else {
    console.log('结论：全部通过，可以发布。');
  }
}

function main() {
  const allowDemo = process.argv.slice(2).includes('--allow-demo');
  const result = check({ allowDemo });
  printReport(result);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
