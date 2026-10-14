import { test } from 'node:test';
import assert from 'node:assert/strict';

import { base64, caesar, morse, railFence, reverse, run, vigenere } from './cipher.mjs';

test('凯撒 +4：BV 号编成密文，也能解回去', () => {
  assert.equal(caesar('BV1xf4y1d7wx', 4), 'FZ1bj4c1h7ab');
  assert.equal(caesar('FZ1bj4c1h7ab', 4, true), 'BV1xf4y1d7wx');
  // 数字与大小写形状都保持不变
  assert.equal(caesar('abcXYZ019', 4), 'efgBCD019');
  // 位移 0 / 26 等于原文，负数位移也能用
  assert.equal(caesar('abc', 0), 'abc');
  assert.equal(caesar('abc', 26), 'abc');
  assert.equal(caesar(caesar('abc', -7), -7, true), 'abc');
});

test('维吉尼亚：密钥 lcr 往返一致，非字母密钥被忽略，纯数字报错', () => {
  const plain = 'BV1xf4y1d7wx';
  const hidden = vigenere(plain, 'lcr');
  assert.notEqual(hidden, plain);
  assert.equal(vigenere(hidden, 'lcr', true), plain);
  assert.equal(vigenere('abc', 'l-c-r'), vigenere('abc', 'lcr'));
  assert.throws(() => vigenere('abc', '123'), /密钥/);
});

test('栅栏：2~5 栏都能往返，中文也不碎', () => {
  const plain = '狂奔在沙漠中暴雨下 BV1xf4y1d7wx';
  for (const rails of [2, 3, 4, 5]) {
    const hidden = railFence(plain, rails);
    assert.notEqual(hidden, plain);
    assert.equal(railFence(hidden, rails, true), plain, `rails=${rails}`);
  }
  // 文字比栏数还短时原样返回；非法栏数报错
  assert.equal(railFence('ab', 5), 'ab');
  assert.throws(() => railFence('abc', 1), /栏/);
});

test('摩斯：字母数字往返，中文会明确报错', () => {
  assert.equal(morse('BV1XF4'), '-... ...- .---- -..- ..-. ....-');
  assert.equal(morse('-... ...- .---- -..- ..-. ....-', true), 'BV1XF4');
  assert.equal(morse('SOS', false), '... --- ...');
  assert.equal(morse('... --- ... / ... --- ...', true), 'SOS SOS');
  assert.throws(() => morse('中文'), /摩斯/);
  assert.throws(() => morse('...---...', true), /摩斯/);
});

test('base64：往返一致，--no-pad 能去掉等号', () => {
  assert.equal(base64('BV1xf4y1d7wx'), 'QlYxeGY0eTFkN3d4');
  assert.equal(base64('QlYxeGY0eTFkN3d4', true), 'BV1xf4y1d7wx');
  assert.equal(base64('ab', false, false), 'YWI');
  assert.equal(base64('YWI', true), 'ab');
  assert.equal(base64(base64('中文', false, false), true), '中文');
});

test('reverse：按码点倒序，中文与 emoji 不会碎成半个字', () => {
  assert.equal(reverse('abc'), 'cba');
  assert.equal(reverse('你好🎂'), '🎂好你');
});

test('run：分派正确，并给出可读的错误', () => {
  assert.equal(run('caesar', 'BV1xf4y1d7wx', { shift: 4 }), 'FZ1bj4c1h7ab');
  assert.equal(run('caesar', 'FZ1bj4c1h7ab', { shift: 4, decode: true }), 'BV1xf4y1d7wx');
  assert.equal(run('rail', 'abcd', { rails: 2 }), railFence('abcd', 2));
  assert.equal(run('morse', '-... ...- .----', { decode: true }), 'BV1');
  assert.equal(run('base64', 'ab', { pad: false }), 'YWI');
  assert.throws(() => run('不存在的算法', 'x'), /不认识的加密方式/);
});
