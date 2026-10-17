/**
 * 生日解密站的页面逻辑。
 *
 * 规则（和 tools/check.mjs 用的是同一份实现，见 shared/levels-utils.js）：
 *   1. '/' 是第一道门；
 *   2. 第 N+1 关的网址 = '/' + 第 N 关的首个答案 + '/'；
 *   3. 输入「归一化后含有」本关答案就算通过，通过后跳到下一关的网址，最后一关进揭晓页。
 * 所有关卡都在这一页里渲染，所以线上不需要为每个密钥建文件，也不需要 404 页。
 */

import { levels, reveal, site } from './levels.js';
import { answerMatches, buildRoutes, matchLevel, normalizePath, routeSeed } from './shared/levels-utils.js';

const ROUTES = buildRoutes(levels);
const LAST_INDEX = levels.length - 1;
// 全局编号：第 1 关在洛谷上，网站从第 2 关开始（site.firstGate）
const FIRST_GATE = Number(site.firstGate ?? 1);
const TOTAL_GATES = FIRST_GATE + LAST_INDEX;
const TRANSITION_MS = 700;

const view = document.getElementById('view');
const footNote = document.getElementById('foot-note');
const copyLink = document.getElementById('copy-link');

/** 触屏设备不自动抢焦点，免得键盘突然弹出来把页面顶走 */
const prefersFocus = window.matchMedia?.('(pointer: fine)').matches ?? true;

let transitionTimer = null;

function pick(root, name) {
  return root.querySelector(`[data-el="${name}"]`);
}

function cloneTemplate(id) {
  return document.getElementById(id).content.cloneNode(true);
}

function shake(card) {
  if (!card) return;
  card.classList.remove('shake');
  void card.offsetWidth; // 强制重排，让动画能重新播放
  card.classList.add('shake');
}

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('execCommand 复制失败');
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else legacyCopy(text);
    button.textContent = '已复制';
  } catch {
    button.textContent = '复制失败，请手动选中';
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1600);
}

function focusInput(input) {
  if (!prefersFocus) return;
  window.setTimeout(() => {
    input.focus({ preventScroll: true });
  }, 80);
}

/** 把一条提示渲染成 <li>：字符串就是文字，{ image } 就是一张图（可以再带 text）。 */
function buildHintItem(entry) {
  const item = document.createElement('li');
  item.className = 'hint-item';
  if (typeof entry === 'string') {
    item.textContent = entry;
    return item;
  }
  if (entry?.text) {
    const text = document.createElement('span');
    text.textContent = entry.text;
    item.append(text);
  }
  if (entry?.image) {
    const image = document.createElement('img');
    image.className = 'hint-image';
    image.src = entry.image;
    image.alt = entry.imageAlt ?? '';
    image.loading = 'lazy';
    item.append(image);
  }
  return item;
}

/** 分级提示：点一次给一条，已经给出的留在页面上不消失。 */
function setupHints(root, level) {
  const button = pick(root, 'hintbtn');
  const list = pick(root, 'hintlist');
  const hints = Array.isArray(level.hints) ? level.hints : [];
  if (hints.length === 0) return;

  let shown = 0;
  button.hidden = false;
  button.textContent = '给一条提示';
  button.addEventListener('click', () => {
    if (shown >= hints.length) return;
    list.append(buildHintItem(hints[shown]));
    shown += 1;
    if (shown >= hints.length) {
      button.disabled = true;
      button.textContent = '提示已经全部给完了';
    } else {
      button.textContent = `还要提示（已给 ${shown} / ${hints.length}）`;
    }
  });
}

/** 把同学粘进来的东西变成路径：整条链接也认。 */
function toPath(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return '/';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.startsWith('//')) {
    try {
      return new URL(text, location.origin).pathname;
    } catch {
      /* 解析不了就按普通文字处理 */
    }
  }
  return `/${text.replace(/^\/+/, '')}/`;
}

/** 表单：Enter 提交；中文输入法组合期间不提交。 */
function attachSubmit({ form, input, message, card, onSubmit }) {
  let composing = false;
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('input', () => {
    message.textContent = '';
    message.classList.remove('is-bad');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (composing) return;
    onSubmit();
  });
}

function showTransition({ kicker, key, done }) {
  const fragment = cloneTemplate('tpl-transition');
  pick(fragment, 'kicker').textContent = kicker;
  const keyElement = pick(fragment, 'key');
  if (key) keyElement.textContent = key;
  else keyElement.hidden = true;

  view.replaceChildren(fragment);
  footNote.textContent = '';
  copyLink.hidden = true;

  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(done, TRANSITION_MS);
}

function renderLevel(hit) {
  const { index, level } = hit;
  const fragment = cloneTemplate('tpl-level');
  const card = fragment.querySelector('.card');
  const input = pick(fragment, 'input');
  const message = pick(fragment, 'msg');

  pick(fragment, 'step').textContent = `第 ${FIRST_GATE + index} / ${TOTAL_GATES} 关`;
  pick(fragment, 'title').textContent = level.title;
  if (level.face) {
    const face = pick(fragment, 'face');
    face.textContent = level.face;
    face.hidden = false;
  }

  // 谜面可以是密文（没有就整块藏起来）
  if (level.cipherText) {
    pick(fragment, 'cipher').textContent = level.cipherText;
    pick(fragment, 'copy').addEventListener('click', (event) => {
      copyText(level.cipherText, event.currentTarget);
    });
  } else {
    pick(fragment, 'cipherbox').hidden = true;
  }

  attachSubmit({
    form: pick(fragment, 'form'),
    input,
    message,
    card,
    onSubmit: () => submitAnswer({ index, level, raw: input.value, card, message }),
  });

  setupHints(fragment, level);

  view.replaceChildren(fragment);
  document.title = level.title;
  footNote.textContent = '';
  copyLink.hidden = false;
  focusInput(input);
}

function submitAnswer({ index, level, raw, card, message }) {
  if (!answerMatches(level, raw)) {
    message.textContent = site.wrongAnswer;
    message.classList.add('is-bad');
    shake(card);
    return;
  }

  // 显示"真正的密钥"（也就是网址里那一段），而不是同学可能多写了的整串输入
  const key = routeSeed(level);

  if (index < LAST_INDEX) {
    const nextRoute = ROUTES[index + 1];
    if (!nextRoute) {
      message.textContent = '下一关的网址还没配好，去 levels.js 补上答案（然后跑 node tools/check.mjs）。';
      message.classList.add('is-bad');
      return;
    }
    showTransition({
      kicker: site.unlocked,
      key,
      done: () => {
        history.pushState(null, '', nextRoute);
        render();
      },
    });
    return;
  }

  showTransition({
    kicker: site.finalUnlocked,
    key: '',
    done: () => {
      history.replaceState(null, '', `${location.pathname}?solved=1`);
      render();
    },
  });
}

function renderReveal() {
  const fragment = cloneTemplate('tpl-reveal');
  pick(fragment, 'title').textContent = reveal.title;

  const body = pick(fragment, 'body');
  for (const paragraph of reveal.paragraphs ?? []) {
    const element = document.createElement('p');
    element.textContent = paragraph;
    body.append(element);
  }
  for (const source of Array.isArray(reveal.images) ? reveal.images : []) {
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    image.className = 'letter-photo';
    body.append(image);
  }

  const signature = pick(fragment, 'sign');
  if (reveal.signature) signature.textContent = reveal.signature;
  else signature.hidden = true;

  view.replaceChildren(fragment);
  document.title = reveal.title;
  footNote.textContent = `全部 ${TOTAL_GATES} 道门都开了。`;
  copyLink.hidden = false;
}

function tryKey(raw, card, message) {
  const hit = matchLevel(levels, toPath(raw));
  if (!hit) {
    message.textContent = site.wrongAnswer;
    message.classList.add('is-bad');
    shake(card);
    return;
  }
  history.pushState(null, '', hit.route);
  render();
}

function renderLocked() {
  const fragment = cloneTemplate('tpl-locked');
  const card = fragment.querySelector('.card');
  const input = pick(fragment, 'input');
  const message = pick(fragment, 'msg');

  pick(fragment, 'title').textContent = site.notFoundTitle;
  pick(fragment, 'hint').textContent = site.notFoundHint;

  attachSubmit({
    form: pick(fragment, 'form'),
    input,
    message,
    card,
    onSubmit: () => tryKey(input.value, card, message),
  });

  view.replaceChildren(fragment);
  document.title = site.notFoundTitle;
  footNote.textContent = '';
  copyLink.hidden = true;
  focusInput(input);
}

function render() {
  window.clearTimeout(transitionTimer);

  const query = new URLSearchParams(location.search);
  const hit = matchLevel(levels, location.pathname);

  // 被聊天软件加了标点、或者手输时少了斜杠：把地址栏规范到真正那一关
  if (hit && normalizePath(hit.route) !== normalizePath(location.pathname)) {
    history.replaceState(null, '', hit.route + location.search);
  }

  if (!hit) {
    renderLocked();
    return;
  }
  if (hit.index === LAST_INDEX && query.get('solved') === '1') {
    renderReveal();
    return;
  }
  renderLevel(hit);
}

copyLink.addEventListener('click', () => copyText(location.href, copyLink));
window.addEventListener('popstate', render);

render();
