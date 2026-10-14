/**
 * 浏览器与 Node 共用的纯函数（零依赖 ES module）。
 *
 * 判定规则只在这里实现一次：网页用它们决定"答对没有、该去哪一页"，
 * tools/check.mjs 用同样的函数把整条链路空跑一遍。
 * 因此"本地自检通过"就等于"浏览器里一定走得通"。
 */

/** 答案归一化：全角转半角（NFKC）、去掉所有空白、统一小写。 */
export function normalize(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

/** 安全解码：非法 % 序列（手改地址栏、爬虫乱拼）不抛异常。 */
export function decodePathSafe(value) {
  const raw = String(value ?? '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 把任意路径规范成可比较的形式：解码 → 归一化 → 前后各补一个斜杠。
 * '/' → '/'；'a'、'/a'、'/a/'、'/%61/' 归一化后都是 '/a/'。
 */
export function normalizePath(pathname) {
  const decoded = decodePathSafe(pathname);
  const core = normalize(decoded.replace(/^\/+/, '').replace(/\/+$/, ''));
  return core === '' ? '/' : `/${core}/`;
}

/** 答案 → 通过本关后要打开的网址（百分号编码）。空答案返回 null。 */
export function routeOfAnswer(answer) {
  const text = String(answer ?? '');
  if (text === '') return null;
  return `/${encodeURIComponent(text)}/`;
}

/** 用来生成"下一关网址"的那个答案：每关的首个答案。 */
export function routeSeed(level) {
  return Array.isArray(level?.answers) ? String(level.answers[0] ?? '') : '';
}

/**
 * 关卡网址表：第 1 关固定在 '/'，
 * 第 N+1 关网址 = '/' + 第 N 关的首个答案 + '/'。
 * 密钥即答案，答案即网址，不需要手工维护路由。
 */
export function buildRoutes(levels) {
  return (levels ?? []).map((level, index) => {
    if (index === 0) return '/';
    return routeOfAnswer(routeSeed(levels[index - 1]));
  });
}

/** 归一化后非空的答案列表（防止空答案把所有人都放行）。 */
export function normalizedAnswers(level) {
  if (!Array.isArray(level?.answers)) return [];
  return level.answers.map(normalize).filter((answer) => answer.length > 0);
}

/**
 * 找出输入命中的那个答案（取最长匹配），没命中返回 null。
 * 判定是"包含"：输入里含有答案就算过，所以同学多写几个字、写法有点差别都不影响。
 */
export function matchedAnswer(level, input) {
  const value = normalize(input);
  if (value === '') return null;
  const hits = normalizedAnswers(level).filter((answer) => value.includes(answer));
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.length - a.length);
  const target = hits[0];
  return (level.answers ?? []).find((answer) => normalize(answer) === target) ?? null;
}

/** 输入是否通过本关。 */
export function answerMatches(level, input) {
  return matchedAnswer(level, input) !== null;
}

/**
 * 路径 → 关卡。
 * 1) 先按规范化网址精确匹配（'/a'、'/a/'、'/%61/' 等效）；
 * 2) 再退一步：路径里含有某个"能构成网址的答案"也认（取最长匹配）。
 *    这一条是给被聊天软件加了标点、或者前后多粘了几个字的链接兜底的：
 *    命中后解析到该答案开启的下一关，页面会把地址栏规范回去。
 * 返回 { index, level, route, exact }，没命中返回 null。
 */
export function matchLevel(levels, pathname) {
  const list = levels ?? [];
  const routes = buildRoutes(list);
  const target = normalizePath(pathname);

  for (let i = 0; i < list.length; i += 1) {
    if (routes[i] && normalizePath(routes[i]) === target) {
      return { index: i, level: list[i], route: routes[i], exact: true };
    }
  }

  // 注意：一个答案同时是"上一关的答案"和"下一关的网址"，
  // 所以回退只拿 answers[0]（真正构成网址的那个）来比对，并解析到它开启的下一关。
  let best = null;
  for (let i = 0; i + 1 < list.length; i += 1) {
    if (!routes[i + 1]) continue;
    const seed = normalize(routeSeed(list[i]));
    if (seed !== '' && target.includes(seed) && (best === null || seed.length > best.length)) {
      best = { length: seed.length, index: i + 1, level: list[i + 1], route: routes[i + 1] };
    }
  }
  if (best === null) return null;
  return { index: best.index, level: best.level, route: best.route, exact: false };
}
