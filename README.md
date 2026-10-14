# 生日解密平台

给**一位寿星**做的三道门解密闯关站：打开网址看到一串密文，解开密文去看某个视频，
把视频里那句话填进输入框，页面就会"生成新密钥"跳到下一关，最后一道门后面是生日信。

**答案即密钥，密钥即网址。** 第 1 关的答案是「狂奔在沙漠中暴雨下」，
所以第 2 关的网址就是 `主域名/狂奔在沙漠中暴雨下`（地址栏里显示成百分号编码，正常）。

零依赖、零构建：全部是 HTML + CSS + 原生 ES module，Node 只用来跑本地小工具，不需要 `pnpm install`。

## 现在的三关

| 关卡 | 网址 | 密文 | 答案（输入里含有它即通过） | 状态 |
|---|---|---|---|---|
| 第一道门 | `/` | `FZ1bj4c1h7ab`（凯撒 +4） | 狂奔在沙漠中暴雨下 | ✅ 真实内容 |
| 第二道门 | `/狂奔在沙漠中暴雨下/` | `DEMO-GATE-2` | 示例答案二 | ⚠️ 示例，待替换 |
| 第三道门 | `/示例答案二/` | `DEMO-GATE-3` | 示例答案三 | ⚠️ 示例，待替换 |

第二、三关的网址是**自动派生**的：第 N+1 关的网址 = `/' 第 N 关的首个答案 '/`。
你只写答案，不用管网址。写新内容的步骤见 [content/AUTHORING.md](content/AUTHORING.md)。

## 目录

```
public/                 ← 部署出去的就是这个目录
  index.html            单页外壳（关卡 / 未知密钥 / 揭晓三种视图的模板）
  app.js                路由、判定、过渡动画
  levels.js             ★ 题库与全部文案，平时只改这个文件
  styles.css            深色主题、抖动反馈、响应式
  shared/levels-utils.js  归一化与网址派生（网页和 tools/ 共用同一份实现）
  favicon.svg  robots.txt  _headers
tools/
  serve.mjs             本地预览服务器（行为对齐 Pages 的 SPA 回退）
  cipher.mjs            生成/回解密文
  url.mjs               把答案变成可分享的链接
  check.mjs             配置自检 + 整条链路空跑
  *.test.mjs            单元测试
content/AUTHORING.md    怎么写新关卡
```

## 本地预览

```bash
node tools/serve.mjs          # 打开 http://127.0.0.1:8788/
node tools/serve.mjs --port 9000
```

写内容前后各跑一次自检与测试：

```bash
node tools/check.mjs --allow-demo   # 还有示例内容时用这个
node tools/check.mjs                # 内容都写完、准备发布时用这个（有示例内容就报错）
node tools/levels-utils.test.mjs && node tools/cipher.test.mjs   # 或 pnpm test
```

`check.mjs` 会把整条链路空跑一遍，例如现在输出：

```
链路空跑
  /  →  输入「狂奔在沙漠中暴雨下」  →  /狂奔在沙漠中暴雨下/
  /狂奔在沙漠中暴雨下/  →  输入「示例答案二」  →  /示例答案二/
  /示例答案二/  →  输入「示例答案三」  →  揭晓页（生日快乐）
```

判定规则和网页用的是同一份代码，所以**这里通过就等于浏览器里走得通**。

## 小工具

```bash
# 生成密文（凯撒：字母后移四位，数字不动）
node tools/cipher.mjs caesar --text "BV1xf4y1d7wx" --shift 4        # → FZ1bj4c1h7ab
node tools/cipher.mjs caesar --text "FZ1bj4c1h7ab" --shift 4 --decode

# 其它方式：vigenere（默认密钥 lcr）/ railfence / morse / base64 / reverse
node tools/cipher.mjs vigenere --text "BV1qh4y1x7Zk" --key lcr      # → MX1hs4a1o7Km
node tools/cipher.mjs base64   --text "BV1qh4y1x7Zk"                # → QlYxcWg0eTF4N1pr
node tools/cipher.mjs morse    --text "BV1XF4"
node tools/cipher.mjs railfence --text "要藏的话" --rails 2

# 把答案变成链接（中文会转成百分号编码，避免聊天软件截断）
node tools/url.mjs "狂奔在沙漠中暴雨下" --host https://你的域名
```

`--text` 不写就从标准输入读，方便直接粘一段中文。

## 部署到 Cloudflare Pages

**只要记住一件事：`public/` 里不要放 `404.html`。**
Cloudflare Pages 在顶层没有 `404.html` 时会按单页应用处理：任何没有对应静态文件的路径，
都以 200 返回 `/` 的内容。这正是 `主域名/狂奔在沙漠中暴雨下` 能直接打开、刷新、分享的原因；
一旦放了 `404.html`，所有密钥网址都会变成 404。也**不需要** `_redirects`
（`/* /index.html 200` 这类重写会把 `app.js` 一起吃掉）。

（依据：[Serving Pages · Cloudflare Docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)）

方式一 · 直接上传（最省事）：

```bash
pnpm dlx wrangler pages deploy public
# 或者在 Dashboard 里新建 Pages 项目，把 public 目录拖进去
```

方式二 · 连接 Git 仓库：

```bash
git init && git add . && git commit -m "生日解密站"   # 推到 GitHub / GitLab 后，在 Pages 里选这个仓库
```

- Framework preset：`None`
- Build command：**留空**
- Build output directory：`public`

改完内容重新部署即可（改 `public/levels.js`，push 或重新上传）。

部署后核对四件事：

1. `/` 显示第一关；
2. 直接打开 `/狂奔在沙漠中暴雨下` 能进第二关（无尾斜杠也要能进）；
3. 随便打开 `/abcd/` 显示"这串密钥打不开任何一道门"，而不是 Cloudflare 的 404 页；
4. 响应头里有 `x-robots-tag: noindex`（`_headers` 生效）。

想真正做访问控制（现在不是）再上 Cloudflare Access。

## 已知取舍

- **题库是明文**：懂行的人翻 `levels.js` 能看到答案、也能直接拼出第二、三关的网址和最后一封信。
  这是"答案即网址"的必然结果，换来的是你自己改内容极简单。想源码不含答案，
  只需把 `shared/levels-utils.js` 里的判定改成哈希严格匹配（代价：必须一字不差，不能"包含"通过）。
- **包含判定很宽松**：答案是"输入里含有就算过"。往好了说是同学多写几个字也能过，
  往坏了说是敏感度低；`check.mjs` 会提醒过短的答案。
- **`noindex` 不是访问控制**：只是请搜索引擎别收录，拿到链接的人都能打开。
- **别放真正敏感的内容**：站点是公开的，密钥在地址栏里、题库在源码里。

## 手机上的表现

- 触屏设备不会自动弹出键盘（桌面端才会自动聚焦输入框，方便直接开始打字）。
- 密文可以整段选中/一键复制，长密文会换行而不是撑破页面。
- 表单在窄屏变成上下布局，按钮占满一行。
