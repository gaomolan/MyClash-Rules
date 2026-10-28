'use strict';
/* WP-14 原型 3a：lookbehind 微探针（R-012）。仅用 RegExp/console，可在任意 JS 引擎下运行：
 *   node lookbehind_probe.js | bun lookbehind_probe.js | qjs lookbehind_probe.js
 * 逐项报告：后顾断言编译、负向后顾编译、后顾+边界组合（地区正则形态）、
 * Unicode 模式 + 字母边界后顾（倍率正则形态）、命名分组（脚本未用，作参考）。 */
const probes = [
  ['lookbehind 编译 (?<=a)b', () => { const r = new RegExp('(?<=a)b'); return r.test('ab') && !r.test('xb'); }],
  ['负向后顾 (?<!a)b', () => { const r = new RegExp('(?<!a)b'); return r.test('xb') && !r.test('ab'); }],
  ['地区形态 (?<![A-Za-z])HK(?![A-Za-z])', () => { const r = new RegExp('(?<![A-Za-z])HKG?(?![A-Za-z])', 'i'); return r.test('香港 HK 01') && !r.test('xHKGx'); }],
  ['倍率形态 (?<![\\d.])0(\\.[0-5])', () => { const r = new RegExp('(?<![\\d.])0(\\.[0-5])'); return r.test('节点 0.2x') && !r.test('节点 10.2x'); }],
  ['Unicode iu 标志 + 后顾', () => { const r = new RegExp('(?<![A-Za-z])free(?![A-Za-z])', 'iu'); return r.test('Free 节点') && !r.test('Freedom'); }],
  ['零宽字符类剥离（\\u200B 等）', () => '香\u200B港'.replace(/[\u200B\uFEFF]/g, '') === '香港'],
];
let pass = 0;
for (const [name, fn] of probes) {
  try { const r = fn(); console.log(`${r ? 'PASS' : 'FAIL'} ${name}`); if (r) pass++; }
  catch (e) { console.log(`ERROR ${name}: ${e.message}`); }
}
console.log(`lookbehind 探针：${pass}/${probes.length} 通过；引擎=${typeof process !== 'undefined' && process.versions ? JSON.stringify(process.versions) : (typeof globalThis.Bun !== 'undefined' ? 'bun ' + Bun.version : 'unknown')}`);
