#!/usr/bin/env node
/**
 * 生成 / 回解密文的小工具（零依赖，只用 Node 内置能力）。
 *
 *   node tools/cipher.mjs caesar   --text "BV1xf4y1d7wx" --shift 4
 *   node tools/cipher.mjs caesar   --text "FZ1bj4c1h7ab" --shift 4 --decode
 *   node tools/cipher.mjs vigenere --text "要藏的话" --key lcr
 *   node tools/cipher.mjs railfence --text "要藏的话" --rails 2
 *   node tools/cipher.mjs morse    --text "BV1xf4y1d7wx"
 *   node tools/cipher.mjs base64   --text "BV1xf4y1d7wx" [--no-pad]
 *   node tools/cipher.mjs reverse  --text "要藏的话"
 *
 * 不给 --text 就从标准输入读，方便直接粘一段中文进来。
 * 结果只写到标准输出（方便直接复制或管道），提示信息写到标准错误。
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.',
  '=': '-...-', '+': '.-.-.', '-': '-....-', ':': '---...', "'": '.----.',
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const isLetter = (char) => /[A-Za-z]/.test(char);

function letterBase(char) {
  return char <= 'Z' ? 65 : 97;
}

/** 凯撒位移：只动字母，数字和其他字符原地不动。 */
export function caesar(text, shift, decode = false) {
  const offset = ((decode ? -shift : shift) % 26 + 26) % 26;
  return [...text]
    .map((char) => {
      if (!isLetter(char)) return char;
      const base = letterBase(char);
      return String.fromCharCode(((char.charCodeAt(0) - base + offset) % 26) + base);
    })
    .join('');
}

/** 维吉尼亚：密钥按字母循环使用，非字母字符不消耗密钥。 */
export function vigenere(text, key, decode = false) {
  const cleanKey = [...key].filter(isLetter).map((char) => char.toLowerCase().charCodeAt(0) - 97);
  if (cleanKey.length === 0) throw new Error('维吉尼亚需要一个至少含一个字母的密钥（--key lcr）');
  let cursor = 0;
  return [...text]
    .map((char) => {
      if (!isLetter(char)) return char;
      const base = letterBase(char);
      const shift = cleanKey[cursor % cleanKey.length];
      cursor += 1;
      const raw = char.charCodeAt(0) - base + (decode ? -shift : shift);
      return String.fromCharCode(((raw % 26) + 26) % 26 + base);
    })
    .join('');
}

function railPattern(length, rails) {
  const pattern = [];
  let row = 0;
  let step = 1;
  for (let i = 0; i < length; i += 1) {
    pattern.push(row);
    if (row === 0) step = 1;
    else if (row === rails - 1) step = -1;
    row += step;
  }
  return pattern;
}

/** 栅栏密码（锯齿分栏）。 */
export function railFence(text, rails = 2, decode = false) {
  const chars = [...text];
  if (!Number.isInteger(rails) || rails < 2) throw new Error('栅栏的栏数 --rails 至少要 2');
  if (chars.length <= rails) return text;
  const pattern = railPattern(chars.length, rails);

  if (!decode) {
    const rows = Array.from({ length: rails }, () => []);
    chars.forEach((char, index) => rows[pattern[index]].push(char));
    return rows.map((row) => row.join('')).join('');
  }

  const counts = Array.from({ length: rails }, (_, row) => pattern.filter((r) => r === row).length);
  const rows = [];
  let cursor = 0;
  for (let row = 0; row < rails; row += 1) {
    rows.push(chars.slice(cursor, cursor + counts[row]));
    cursor += counts[row];
  }
  const filled = Array.from({ length: rails }, () => 0);
  return pattern
    .map((row) => {
      const char = rows[row][filled[row]];
      filled[row] += 1;
      return char;
    })
    .join('');
}

/** 摩斯：字母与数字用标准码表，单词之间用 / 分隔，多个空格压成一个。 */
export function morse(text, decode = false) {
  if (!decode) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words
      .map((word) =>
        [...word]
          .map((char) => {
            const upper = char.toUpperCase();
            if (MORSE[upper]) return MORSE[upper];
            throw new Error(`摩斯密码编不了这个字符：「${char}」——只能编英文字母、数字和常用符号`);
          })
          .join(' '),
      )
      .join(' / ');
  }
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (token === '/' || token === '|') return ' ';
      const char = MORSE_REVERSE[token];
      if (!char) throw new Error(`摩斯密码里没有这一段：「${token}」`);
      return char;
    })
    .join('');
}

export function base64(text, decode = false, pad = true) {
  if (!decode) {
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    return pad ? encoded : encoded.replace(/=+$/, '');
  }
  return Buffer.from(text, 'base64').toString('utf8');
}

export function reverse(text) {
  return [...text].reverse().join('');
}

export function run(cipher, text, options = {}) {
  const decode = Boolean(options.decode);
  const shift = Number(options.shift ?? 4);
  const rails = Number(options.rails ?? 2);
  const key = String(options.key ?? 'lcr');

  switch (cipher) {
    case 'caesar':
      if (!Number.isInteger(shift)) throw new Error('--shift 需要是整数');
      return caesar(text, shift, decode);
    case 'vigenere':
      return vigenere(text, key, decode);
    case 'railfence':
    case 'rail':
      return railFence(text, rails, decode);
    case 'morse':
      return morse(text, decode);
    case 'base64':
      return base64(text, decode, options.pad !== false);
    case 'reverse':
      return reverse(text);
    default:
      throw new Error(`不认识的加密方式：「${cipher}」（可用：caesar / vigenere / railfence / morse / base64 / reverse）`);
  }
}

const HELP = `用法：node tools/cipher.mjs <方式> --text "..." [--decode] [选项]

方式与选项：
  caesar     --shift 4        字母位移，数字和其他字符不动（默认 4）
  vigenere   --key lcr        维吉尼亚，密钥默认 lcr
  railfence  --rails 2        栅栏密码，默认 2 栏
  morse                       摩斯，字母数字与常用符号
  base64     [--no-pad]       Base64，--no-pad 去掉末尾的 =
  reverse                     倒序

  --decode                    解开而不是生成
  --text "..."                要处理的文字；不写就从标准输入读
  -h, --help                  显示这段帮助`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--decode') options.decode = true;
    else if (arg === '--no-pad') options.pad = false;
    else if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=');
      const value = inline ?? argv[i + 1];
      if (inline === undefined) i += 1;
      options[name] = value;
    } else positional.push(arg);
  }
  return { positional, options };
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (options.help || positional.length === 0) {
    console.log(HELP);
    process.exit(positional.length === 0 && !options.help ? 1 : 0);
  }
  const [cipher] = positional;
  const text = options.text !== undefined ? String(options.text) : readStdin();
  const result = run(cipher, text.replace(/\r?\n$/, ''), options);
  process.stdout.write(result + '\n');
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
