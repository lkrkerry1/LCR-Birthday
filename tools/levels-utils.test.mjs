import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  answerMatches,
  buildRoutes,
  matchLevel,
  matchedAnswer,
  normalize,
  normalizePath,
  routeOfAnswer,
} from '../public/shared/levels-utils.js';
import { levels, reveal, site } from '../public/levels.js';

const ANSWER_1 = '狂奔在沙漠中暴雨下';

const fixture = [
  { label: '一', answers: [ANSWER_1] },
  { label: '二', answers: ['答案二'] },
  { label: '三', answers: ['答案三'] },
];

test('normalize：全角、空白、大小写都会被抹平', () => {
  assert.equal(normalize('ＢＶ１ｘｆ４'), 'bv1xf4');
  assert.equal(normalize('  狂风\t暴雨\n'), '狂风暴雨');
  assert.equal(normalize('ABC'), 'abc');
  assert.equal(normalize('狂奔在沙漠中暴雨下'), ANSWER_1);
  assert.equal(normalize('　狂风　暴　雨　'), '狂风暴雨');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('normalizePath：有无斜杠、编码形式都归一到同一形态', () => {
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('/A/'), '/a/');
  assert.equal(normalizePath('a'), '/a/');
  assert.equal(normalizePath('/a'), '/a/');
  assert.equal(normalizePath('/%61/'), '/a/');
  assert.equal(normalizePath('/狂奔在沙漠中暴雨下'), `/${ANSWER_1}/`);
  // 非法 % 序列不能抛异常（手改地址栏时会出现）
  assert.equal(normalizePath('/a%zz'), '/a%zz/');
  assert.equal(normalizePath('/%E7%8B%'), '/%e7%8b%/');
});

test('routeOfAnswer：中文答案编成百分号编码的网址，空答案返回 null', () => {
  assert.equal(routeOfAnswer('abc'), '/abc/');
  assert.equal(routeOfAnswer(''), null);
  assert.equal(
    routeOfAnswer(ANSWER_1),
    '/%E7%8B%82%E5%A5%94%E5%9C%A8%E6%B2%99%E6%BC%A0%E4%B8%AD%E6%9A%B4%E9%9B%A8%E4%B8%8B/',
  );
  assert.equal(normalizePath(routeOfAnswer(ANSWER_1)), `/${ANSWER_1}/`);
});

test('buildRoutes：第 1 关在 /，第 N+1 关网址 = 第 N 关首个答案', () => {
  const routes = buildRoutes(fixture);
  assert.deepEqual(routes.map(normalizePath), ['/', `/${ANSWER_1}/`, '/答案二/']);
});

test('answerMatches / matchedAnswer：包含即通过，空答案不匹配任何人', () => {
  assert.equal(answerMatches(fixture[0], ANSWER_1), true);
  assert.equal(answerMatches(fixture[0], `今天听到了「${ANSWER_1}」这句话`), true);
  assert.equal(answerMatches(fixture[0], ' 狂 奔 在 沙 漠 中 暴 雨 下 '), true);
  assert.equal(answerMatches(fixture[0], '狂奔在沙漠中'), false);
  assert.equal(answerMatches(fixture[0], ''), false);
  assert.equal(answerMatches({ answers: [''] }, '任何东西'), false);
  assert.equal(matchedAnswer(fixture[0], `xx${ANSWER_1}yy`), ANSWER_1);
  assert.equal(matchedAnswer(fixture[0], '不相干'), null);
});

test('matchedAnswer：多个答案互相包含时取最长匹配', () => {
  const level = { answers: ['下雨', '下暴雨了'] };
  assert.equal(matchedAnswer(level, '外面下暴雨了'), '下暴雨了');
  assert.equal(matchedAnswer(level, '好像要下雨'), '下雨');
});

test('matchLevel：精确、无尾斜杠、编码形式都能命中；未知路径返回 null', () => {
  const encoded = routeOfAnswer(ANSWER_1);
  assert.equal(matchLevel(fixture, '/')?.index, 0);
  assert.equal(matchLevel(fixture, '/')?.exact, true);
  assert.equal(matchLevel(fixture, encoded)?.index, 1);
  assert.equal(matchLevel(fixture, `/${ANSWER_1}`)?.index, 1);
  assert.equal(matchLevel(fixture, `/${ANSWER_1}/`)?.index, 1);
  // 第 3 关的网址由第 2 关的答案派生
  assert.equal(matchLevel(fixture, '/答案二/')?.index, 2);
  assert.equal(matchLevel(fixture, '/完全不相干的路径/'), null);
  // 最后一关的答案不再构成任何网址，所以它不出现在回退里
  assert.equal(matchLevel(fixture, '/答案三/'), null);
  assert.equal(matchLevel(fixture, '/答案三啦/'), null);
});

test('matchLevel：被聊天软件加了标点或多粘了字的链接也能救回来', () => {
  const loose = matchLevel(fixture, `/我早就知道是${ANSWER_1}啦`);
  assert.equal(loose?.index, 1);
  assert.equal(loose?.exact, false);
  assert.equal(normalizePath(loose.route), `/${ANSWER_1}/`);

  const punctuated = matchLevel(fixture, `/${ANSWER_1}。`);
  assert.equal(punctuated?.index, 1);
  assert.equal(punctuated?.exact, false);
});

test('matchLevel：配置缺答案时不会把 "/" 当成有效路由', () => {
  const broken = [
    { label: '一', answers: ['甲'] },
    { label: '二', answers: [] }, // 这一关没写答案 → 它开不出任何网址
    { label: '三', answers: ['丙'] },
  ];
  const routes = buildRoutes(broken);
  assert.equal(routes[2], null); // 第 3 关没有网址
  // 只有第 1 关占据 '/'，缺答案的那一关不会来抢
  const owners = routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route && normalizePath(route) === '/')
    .map(({ index }) => index);
  assert.deepEqual(owners, [0]);
  assert.equal(matchLevel(broken, '/')?.index, 0);
  assert.equal(matchLevel(broken, '/%E7%94%B2/')?.index, 1);
});

test('真实题库：第一关能解开，并落到 /狂奔在沙漠中暴雨下/', () => {
  assert.equal(levels.length >= 1, true);
  assert.equal(Number.isInteger(site.firstGate), true);
  assert.equal(reveal.paragraphs.length > 0, true);

  assert.equal(answerMatches(levels[0], ANSWER_1), true);
  assert.equal(matchLevel(levels, `/${ANSWER_1}`)?.index, 1);
  assert.equal(normalizePath(buildRoutes(levels)[1]), `/${ANSWER_1}/`);
});

test('真实题库：从第 1 关出发能一路走到揭晓（不跳过任何一关）', () => {
  const routes = buildRoutes(levels);
  let index = matchLevel(levels, '/')?.index;
  assert.equal(index, 0);

  const walked = [];
  while (index < levels.length - 1) {
    const level = levels[index];
    const seed = level.answers[0];
    assert.equal(answerMatches(level, `我听到的是「${seed}」`), true, `第 ${index + 1} 关答案失效`);
    const nextRoute = routes[index + 1];
    assert.ok(nextRoute, `第 ${index + 2} 关没有网址（答案是否为空？）`);
    const hit = matchLevel(levels, nextRoute);
    assert.equal(hit?.index, index + 1, `${nextRoute} 没能解析到第 ${index + 2} 关`);
    walked.push(`${level.title} → ${nextRoute}`);
    index = hit.index;
  }
  assert.equal(walked.length, levels.length - 1);
  assert.equal(answerMatches(levels[levels.length - 1], levels[levels.length - 1].answers[0]), true);
});
