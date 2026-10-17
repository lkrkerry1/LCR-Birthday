/**
 * 静态"接线"检查：不能开浏览器，就用文本把这层契约钉住。
 * 这些检查能挡住最常见的一类白屏：改了 index.html 的模板，忘了同步 app.js。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const read = (file) => readFileSync(join(PUBLIC, file), 'utf8');

const html = read('index.html');
const app = read('app.js');

const collect = (text, pattern) => [...text.matchAll(pattern)].map((match) => match[1]);

function templateBlock(id) {
  const start = html.indexOf(`<template id="${id}">`);
  assert.notEqual(start, -1, `index.html 里没有模板 ${id}`);
  const end = html.indexOf('</template>', start);
  return html.slice(start, end);
}

/** 每个模板必须提供的元素，app.js 会按名字去找它们。 */
const TEMPLATE_CONTRACT = {
  'tpl-level': ['step', 'title', 'face', 'cipherbox', 'copy', 'cipher', 'form', 'input', 'msg', 'hintbtn', 'hintlist'],
  'tpl-transition': ['kicker', 'key'],
  'tpl-locked': ['title', 'hint', 'form', 'input', 'msg'],
  'tpl-reveal': ['title', 'body', 'sign'],
};

test('每个模板都具备 app.js 要用的 data-el 元素', () => {
  for (const [id, expected] of Object.entries(TEMPLATE_CONTRACT)) {
    const declared = new Set(collect(templateBlock(id), /data-el="([^"]+)"/g));
    for (const name of expected) {
      assert.ok(declared.has(name), `模板 ${id} 缺少 data-el="${name}"`);
    }
  }
});

test('app.js 引用的模板与元素都真实存在', () => {
  const templateIds = new Set(collect(html, /<template id="([^"]+)"/g));
  for (const id of collect(app, /cloneTemplate\('([^']+)'\)/g)) {
    assert.ok(templateIds.has(id), `app.js 引用了不存在的模板 ${id}`);
  }

  const allDataEl = new Set(collect(html, /data-el="([^"]+)"/g));
  for (const name of collect(app, /pick\([^,]+,\s*'([^']+)'\)/g)) {
    assert.ok(allDataEl.has(name), `app.js 去找了不存在的 data-el="${name}"`);
  }

  const ids = new Set(collect(html, /\sid="([^"]+)"/g));
  for (const id of collect(app, /getElementById\('([^']+)'\)/g)) {
    assert.ok(ids.has(id), `app.js 引用了不存在的 id="${id}"`);
  }
});

test('页面用绝对路径引资源、带语言与 noindex，且没有 404.html', () => {
  // 页面会被投递到 /密钥/ 这类深层路径上，相对路径会 404，所以必须是绝对路径
  assert.match(html, /<link rel="stylesheet" href="\/styles\.css"/);
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg"/);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="robots" content="noindex/);

  // 顶层 404.html 会关掉 Cloudflare Pages 的 SPA 回退，密钥网址会全变 404
  assert.equal(existsSync(join(PUBLIC, '404.html')), false, 'public/404.html 必须不存在');
});

test('站点文件齐全，且搜索引擎该屏蔽的都屏蔽了', () => {
  for (const file of ['index.html', 'app.js', 'levels.js', 'styles.css', 'shared/levels-utils.js', 'favicon.svg', 'robots.txt', '_headers']) {
    assert.ok(existsSync(join(PUBLIC, file)), `public/${file} 不存在`);
  }
  assert.match(read('_headers'), /noindex/i);
  assert.match(read('robots.txt'), /Disallow:\s*\/\s*$/m);
});

test('app.js 不做多余的事：没有内联脚本、没有外部依赖', () => {
  assert.equal(/<script(?![^>]*src=)/.test(html), false, 'index.html 里不该有内联脚本');
  const imports = collect(app, /from\s+'([^']+)'/g);
  assert.deepEqual(imports.sort(), ['./levels.js', './shared/levels-utils.js']);
});

test('提示按钮是数据驱动的：没写 hints 的关卡不会显示按钮', () => {
  // 按钮默认 hidden，只有 level.hints 非空时 app.js 才会把它显示出来
  const block = templateBlock('tpl-level');
  assert.match(block, /data-el="hintbtn"[^>]*hidden/, '提示按钮必须默认隐藏');
  assert.match(app, /level\.hints/, 'app.js 应该按关卡数据决定是否显示提示');
});
