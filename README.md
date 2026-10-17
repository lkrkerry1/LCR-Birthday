# 生日解密平台

给**一位寿星**做的解密闯关：**总共三关**。第 1 关在洛谷上（U741873，交一份编译好的程序给 checker 评测，
通过后会打印本站地址）；打开本站就是**第 2 关**——看到一串密文，解开密文去看某个视频，
把视频里那句话填进输入框，页面就会"生成新密钥"跳到**第 3 关**，最后一门后面是生日信。

**答案即密钥，密钥即网址。** 第 2 关的答案是「狂奔在沙漠中暴雨下」，
所以第 3 关的网址就是 `主域名/狂奔在沙漠中暴雨下`（地址栏里显示成百分号编码，正常）。

零依赖、零构建：全部是 HTML + CSS + 原生 ES module，Node 只用来跑本地小工具，不需要 `pnpm install`。

## 现在的关卡

| 关卡 | 位置 | 网址 | 密文 | 答案（输入里含有它即通过） | 状态 |
|---|---|---|---|---|---|
| 第 1 关 | 洛谷 U741873 | — | — | 提交程序，checker 全过即通过 | ✅ 已有（`lcr/` 里那套） |
| 第 2 关 · **骤暗的广播厅** | 本站首页 | `/` | `FZ1bj4c1h7ab`（凯撒 +4） | 狂奔在沙漠中暴雨下 | ✅ 真实内容 |
| 第 3 关 · **寻觅偏僻** | 本站（最后一关，答对即揭晓） | `/狂奔在沙漠中暴雨下/` | `lhy`（密文；图片在第 2 条提示里） | 瘳 | ✅ 真实内容 |

每关的 `title` 就是页面上的**主标题**（显示在「第 x / y 关」那行下面），也会出现在浏览器标签页标题里。
题面文字写在 `face`（也可以只给密文 `cipherText`）；提示项除了字符串，还能写成 `{ image: '/images/xxx.png' }`——
点到那一条时图片才会出现。

网站的编号是**全局的**：`site.firstGate = 2` 表示网站从第 2 关开始，所以页面上显示"第 2 / 3 关""第 3 / 3 关"。
下一关的网址是**自动派生**的：第 N+1 关的网址 = `/' 第 N 关的首个答案 '/`。
你只写答案，不用管网址。写新内容的步骤见 [content/AUTHORING.md](content/AUTHORING.md)。

## 分级提示

每关页面下方都有个「给一条提示」按钮：**点一次给一条，已经给出的会一直留在页面上**（逐条追加到列表里）。
提示写在 `levels.js` 每一关的 `hints` 数组里（必填，至少一条）。

**卡片上不一定有题面**：第二关没有 `face`，题面就靠 `hints[0]` 给（点一下提示才看到"这题大概在问什么"）；
第三关有密文 `lhy`，就显示在密文框里（和普通文字题面一样，也可以写 `face`）。

第二关（骤暗的广播厅）7 级递进：

| # | 提示 | 直接透露 |
|---|---|---|
| 1 | 原谜面（只提「位移」，数字不动） | 暗示凯撒密码 |
| 2 | 直接点名凯撒密码 + 后移四位 | 手法 + 位移量 |
| 3 | 给出密码 `BV1xf4y1d7wx` | 跳过解密 |
| 4 | 给出视频链接 | 去哪看 |
| 5 | 视频是《造亿万吨光芒》 | 内容 |
| 6 | 答案是一句歌词，九个字 | 方向 |
| 7 | 答案就是「狂奔在沙漠中暴雨下」 | 答案 |

第三关（寻觅偏僻）5 级递进，第 2 条是**图片**（点开才出现）：

| # | 提示 | 直接透露 |
|---|---|---|
| 1 | 拼装交织带来指引，而答案源于己身 | 方向 |
| 2 | 一张图（`/images/gate-3.webp`，71 KB） | 图片 |
| 3 | 一个字 | 字数 |
| 4 | 病字头 | 部首 |
| 5 | 答案是：瘳 | 答案 |

⚠️ 因为第二关第 3、4、7 条与第三关第 5 条会直接写出视频号/答案，所以 `levels.js` 里**必然**含有这些内容——
原来"线上题库不能出现 BV 号 / 视频站字样"的自检已经删掉，现在它们是**故意公开**的。

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
  serve.mjs             本地预览服务器（行为对齐 Cloudflare 的 SPA 回退）
  cipher.mjs            生成/回解密文
  url.mjs               把答案变成可分享的链接
  check.mjs             配置自检 + 整条链路空跑
  verify-deploy.mjs     部署后验收：一条命令测线上所有关键路径
  *.test.mjs            单元测试
content/AUTHORING.md    怎么写新关卡
wrangler.jsonc          Cloudflare Workers 部署配置（部署目录 + SPA 回退开关）
.gitattributes          统一换行符，避免跨平台 diff 噪音
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
node tools/levels-utils.test.mjs && node tools/cipher.test.mjs && node tools/page.test.mjs   # 或 pnpm test
```

`check.mjs` 会把整条链路空跑一遍，例如现在输出：

```
链路空跑
  /  →  输入「狂奔在沙漠中暴雨下」  →  /狂奔在沙漠中暴雨下/
  /狂奔在沙漠中暴雨下/  →  输入「示例答案三」  →  揭晓页（生日快乐）
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

## 部署到 Cloudflare

这个站是纯静态的，Cloudflare 的两条路都能跑：**Workers（静态资源）** 和 **Pages**。
本项目当前走的是 **Workers + Workers Builds**，配置已经写进 `wrangler.jsonc`。

### 关键：密钥网址靠"回退"才能打开

`主域名/狂奔在沙漠中暴雨下` 这个路径在磁盘上**没有对应文件**，靠的是"找不到文件就返回
`index.html`"的兜底行为。两个平台的开启方式**不一样**，少哪一边都会让所有密钥链接变成 404：

| 平台 | 怎么开 | 写在哪 |
|---|---|---|
| **Workers**（现在用的） | 必须**显式**声明 `assets.not_found_handling: "single-page-application"` | `wrangler.jsonc`，已配好，别删 |
| **Pages**（备选） | 顶层**不要**放 `404.html`，Pages 会自动按单页应用处理 | 别新建 `public/404.html` 即可 |

另外**不需要** `_redirects`（`/* /index.html 200` 这类重写会把 `app.js` 一起吃掉）。

（依据：[Workers SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) · [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)）

### 方式一 · Workers（本项目现在用的）

Dashboard → Workers & Pages → **Create application** → **Import a repository** → 选
<https://github.com/lkrkerry1/LCR-Birthday>，然后照下表填：

| 字段 | 填什么 |
|---|---|
| Project name | `lcr-birthday`（**必须与 `wrangler.jsonc` 里的 `name` 一字不差**，否则构建会以 "Worker name requirement" 失败） |
| Build command | **留空**（这个站没有构建步骤） |
| Deploy command | `npx wrangler deploy`（保持默认） |

剩下的事交给仓库里的 `wrangler.jsonc`：它声明部署目录 `./public`、打开 SPA 回退、
并把兼容日期定为 `2026-10-14`。`public/_headers`（noindex）和 `public/robots.txt`
在 Workers 静态资源里同样生效。

部署完网址形如 `https://lcr-birthday.<你的子域>.workers.dev`——**但这个域名在国内无代理时打不开**，
必须先绑自己的域名，见下面的「国内访问」一节。之后每次 `git push` 到 `main`
都会自动重新部署——改 `public/levels.js` 就是改关卡内容。

### 方式二 · Pages（备选）

Dashboard → Create application → **Pages** → Connect to Git，选同一个仓库：

- Framework preset：`None`
- Build command：**留空**（官方说法：没有构建步骤就留空）
- Build output directory：`public`

Pages 项目和 Workers 项目是两套东西，**同一时间只走一条**；走 Pages 时**不要**加
`wrangler.jsonc`（Pages 读的是 `pages_build_output_dir`，两边字段不通用，混在一起会校验失败）。

提交署名已经在仓库里设好了（只对这个仓库生效，不动你的全局配置）：

```bash
git log -1 --format='%an <%ae>'      # → lkrkerry1 <152617246+lkrkerry1@users.noreply.github.com>
```

另外为了在这台机器上能连上 GitHub，仓库配置里加了两项（都在 `.git/config`，不影响别的项目）：
`http.sslBackend=openssl`（这里的 schannel 会报 `SEC_E_NO_CREDENTIALS`）和
`credential.interactive=false`（避免弹出凭据窗口卡住命令行）。

想把这个仓库改成私有（Workers 和 Pages 都支持私有仓库）：

```bash
gh repo edit lkrkerry1/LCR-Birthday --visibility private --accept-visibility-change-consequences
```

部署后验收——一条命令跑完：

```bash
node tools/verify-deploy.mjs https://你的域名
```

它会把下面这些逐条测出来（本地 `http://127.0.0.1:8788` 也能跑，只有 `_headers` 那条会变成提醒）：

1. `/` 返回站点外壳，不是 Cloudflare 错误页；
2. `app.js` / `levels.js` / `styles.css` / `shared/levels-utils.js` / `favicon.svg` / `robots.txt` 都能取到且 MIME 正确；
3. **密钥路径**（`/狂奔在沙漠中暴雨下`，带与不带尾斜杠）都能打开；
4. **未知路径返回 200 + 外壳**（SPA 回退生效）——这一条不通过，"密钥即网址" 就断了；
5. 响应头有 `x-robots-tag: noindex`；
6. 提示里带的图片（`public/images/` 下那些）都能取到且是图片类型。

通过后，命令会直接把该发给寿星的链接列出来。

想真正做访问控制（现在不是）再上 Cloudflare Access。

## 国内访问：为什么要绑自己的域名

无代理直连实测（2026-10-14，同一台机器）：

| 目标 | 结果 |
|---|---|
| `https://lcr-birthday.lkrkerry.workers.dev/` | **timeout** |
| `developers.cloudflare.com` | 200，0.16s |
| `www.cloudflare.com` | 200，0.16s |
| `dash.cloudflare.com` | 403（未登录，正常），0.18s |

同一个 Cloudflare IP 段，Cloudflare 自家域名秒开，`*.workers.dev` 却连不上——
被阻断的是**共享域名**（`*.workers.dev`、`*.pages.dev` 在国内属于常年阻断或极不稳的那一类），
不是 Cloudflare 的网络。由此：

- **换成 Pages 没用**，`*.pages.dev` 一样打不开；
- **绑一个自己的域名**，走的还是同一批 Cloudflare 节点，国内大概率能开
  （但**不保证 100%**，速度也一般；要根治就得换国内云 + 备案）。

### 操作步骤

本项目用的域名：**`lcr-birthday.asia`**（阿里云注册）。

> 阿里云域名在**实名认证通过前会被 `clientHold`**：注册局不发布任何解析记录，
> 表现为 `NS`/`A` 全是 NXDOMAIN。这一步没过，改 NS 也没意义，先去实名认证。

1. 买域名。`.com` 最稳；`.top` / `.xyz` / `.site` 首年便宜但续费贵。
   国内注册商（阿里云/腾讯云）需要**实名认证**（约 1 天，注意这不是备案）；
   国外注册商（Porkbun、NameSilo）不需要实名，但要有外币卡/PayPal。
   别买 `.cn`（实名 + 国内注册局额外麻烦）。
   （`.asia` 是否在工信部可备案名单内，本项目还没确认过；哪天真要走备案会再核实，
   不影响绑 Cloudflare 这条路径。）
2. Cloudflare Dashboard → **Add a site** → 输入域名 → 选 **Free** 计划 → 记下分配的两条 nameserver。
3. 回注册商把 DNS 服务器改成那两条，等 Cloudflare 上显示 **Active**（几分钟到几小时）。
4. Cloudflare → **Workers & Pages** → `lcr-birthday` → **Settings** → **Domains & Routes** →
   **Add** → **Custom Domain** → 填顶点域名 `你的域名`（或 `lcr-birthday.你的域名`）。
   Cloudflare 会自动建 DNS 记录并签发证书，不用手工加 A 记录。
5. 之后密钥链接就是 `https://你的域名/狂奔在沙漠中暴雨下`，用工具生成可分享链接：

```bash
node tools/url.mjs "狂奔在沙漠中暴雨下" --host https://你的域名
```

**不需要备案**：备案只针对**境内**服务器与境内容量。域名绑到 Cloudflare（境外节点）不需要；
哪天改成国内云（腾讯云 EdgeOne、阿里云 OSS/CDN）就必须先备案，默认域名当网站也会被云厂商强制下载。

### 绑好之后怎么验证

1. 手机**关 WiFi、用流量**打开 `https://你的域名/abcd/`，
   应显示"这串密钥打不开任何一道门"（而不是超时）；
2. 用多节点工具从各省测一遍（例如 itdog.cn 的 HTTP 测试），确认大部分省份能拿到 200；
3. 全部通过后，把 `https://你的域名/狂奔在沙漠中暴雨下` 这类链接发给寿星即可。

## 已知取舍

- **题库是明文**：懂行的人翻 `levels.js` 能看到答案、也能直接拼出后续关卡的网址和最后一封信。
  这是"答案即网址"的必然结果，换来的是你自己改内容极简单。想源码不含答案，
  只需把 `shared/levels-utils.js` 里的判定改成哈希严格匹配（代价：必须一字不差，不能"包含"通过）。
- **包含判定很宽松**：答案是"输入里含有就算过"。往好了说是同学多写几个字也能过，
  往坏了说是敏感度低；`check.mjs` 会提醒过短的答案。
- **`noindex` 不是访问控制**：只是请搜索引擎别收录，拿到链接的人都能打开。
- **分级提示会剧透**：第二关的 `hints` 递进到最后一条直接写出答案（第 3、4 条还会给出视频号和链接），
  所以想看答案的人点 7 次提示就能拿到——这是"别让人卡死"的取舍，不是漏洞。
- **别放真正敏感的内容**：站点是公开的，密钥在地址栏里、题库在源码里。

## 手机上的表现

- 触屏设备不会自动弹出键盘（桌面端才会自动聚焦输入框，方便直接开始打字）。
- 密文可以整段选中/一键复制，长密文会换行而不是撑破页面。
- 表单在窄屏变成上下布局，按钮占满一行。
