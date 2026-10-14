#!/usr/bin/env node
/**
 * 把一个答案（= 密钥 = 下一关的网址）变成可以直接发出去的链接。
 *
 *   node tools/url.mjs "狂奔在沙漠中暴雨下"
 *   node tools/url.mjs "狂奔在沙漠中暴雨下" --host https:// 你的域名 .pages.dev
 *   node tools/url.mjs "狂奔在沙漠中暴雨下" --plain      只输出链接（方便管道/脚复制）
 *
 * 中文会转成百分号编码：有些聊天软件会把长中文链接截断，
 * 发编码后的链接更稳。
 */

import { pathToFileURL } from 'node:url';

import { normalize, normalizePath, routeOfAnswer } from '../public/shared/levels-utils.js';

const HELP = `用法：node tools/url.mjs "<答案或密钥>" [--host https://你的域名] [--plain]

  --host   拼出完整链接（省略时只输出站内路径）
  --plain  只输出一行结果，不加说明文字`;

/** 把答案转成站内路径与完整链接。 */
export function buildUrl(phrase, { host = '' } = {}) {
  const route = routeOfAnswer(phrase);
  const cleanHost = String(host ?? '').replace(/\/+$/, '');
  return {
    route,
    normalized: normalizePath(route),
    url: route === null ? null : `${cleanHost}${route}`,
  };
}

/** 密钥里不能出现的东西：斜杠会把路径切断，空白与 ? # 会让网址不可靠。 */
export function routeWarnings(phrase) {
  const warnings = [];
  if (String(phrase).trim() === '') warnings.push('密钥是空的，做不出网址。');
  if (String(phrase).includes('/')) warnings.push('密钥里有 “/”，会把网址切断，建议换一个说法。');
  if (/\s/.test(String(phrase))) warnings.push('密钥里有空格，网址会被编码成 %20，建议去掉空格。');
  if (/[?#]/.test(String(phrase))) warnings.push('密钥里有 “?” 或 “#”，会破坏网址，建议换掉。');
  return warnings;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const plain = argv.includes('--plain');
  let host = '';
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--plain') continue;
    if (arg === '--host') {
      host = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
      continue;
    }
    if (!arg.startsWith('--')) positional.push(arg);
  }

  const phrase = positional.join(' ');
  const { route, url } = buildUrl(phrase, { host });
  if (route === null) {
    console.error('出错：密钥不能为空。');
    process.exit(1);
  }

  for (const warning of routeWarnings(phrase)) console.error(`注意：${warning}`);

  if (plain) {
    console.log(host ? url : route);
    return;
  }

  console.log(`密钥：${phrase}`);
  console.log(`归一化：${normalize(phrase) === '' ? '（空）' : normalize(phrase)}`);
  console.log(`站内路径：${route}`);
  if (host) {
    console.log(`完整链接：${url}`);
  } else {
    console.log('完整链接：加上 --host https://你的域名 就能得到可分享的完整链接');
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`出错：${error.message}`);
    process.exit(1);
  }
}
