/**
 * 题库与全部文案 —— 你平时只需要改这个文件。
 *
 * 玩法：同学的输入「归一化后含有」这一关 answers 里的任意一条，就算通过。
 * 通过之后，页面会打开下一关的网址，而下一关的网址 =
 * 「/' 上一关的首个答案 '/」，也就是：答案即密钥，密钥即网址。
 * 例：第 1 关答案是「狂奔在沙漠中暴雨下」，那么第 2 关的网址就是
 *     /狂奔在沙漠中暴雨下/
 * 所以你只写答案，不用管网址；网址由 public/shared/levels-utils.js 自动派生。
 *
 * 写新关卡的步骤见 content/AUTHORING.md；
 * 密文可以用 `node tools/cipher.mjs` 生成；
 * 改完务必跑一遍 `node tools/check.mjs`，它会把整条链路空跑一遍。
 */

export const site = {
  title: '解密 · 生日计划',
  subtitle: '三道门，后面是给你的东西',
  intro: '别急着翻源码——翻到的也只有谜面。',
  wrongAnswer: '不对。再想想，或者换个写法试试。',
  unlocked: '新密钥已生成',
  finalUnlocked: '最后一道门已经打开',
  notFoundTitle: '这串密钥打不开任何一道门',
  notFoundHint: '如果你手里有密钥，把它整串粘进来就行。',
};

export const levels = [
  {
    label: '第一道门',
    face: '这串痕迹来自一次「位移」：所有字母都往后多走了四步，数字站在原地没动。解出来的东西会带你去一个地方，答案在那里等着你。',
    cipherText: 'FZ1bj4c1h7ab',
    // 输入里含有它就通过（大小写、空格、全角半角都无所谓）
    answers: ['狂奔在沙漠中暴雨下'],
  },
  {
    label: '第二道门',
    face: '【示例关卡，等你替换】第二关的谜题还没写。先照示例走通链路：在输入框里填「示例答案二」就能继续。',
    cipherText: 'DEMO-GATE-2',
    answers: ['示例答案二'],
    demo: true,
  },
  {
    label: '第三道门',
    face: '【示例关卡，等你替换】最后一道门同样还没写。填「示例答案三」就能看到揭晓页。',
    cipherText: 'DEMO-GATE-3',
    answers: ['示例答案三'],
    demo: true,
  },
];

export const reveal = {
  title: '生日快乐',
  paragraphs: [
    '【示例正文，等你替换】这里写你想说的话，可以分成好几段。',
    '每段都会自动排成一段；换行、标点都直接照写就行。',
  ],
  signature: '—— 你的同学',
  // 以后想加照片：把路径写进来即可，例如 ['/photos/1.jpg']，留空就是纯文字。
  images: [],
};
