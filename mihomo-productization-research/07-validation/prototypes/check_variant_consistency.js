'use strict';
/* WP-14 原型 2：三件套语法 + 开关集一致性检查（产品化方向：CI 常设）。
 * 断言（依据 WP-1 基线 E4 结论）：
 *   A1 三件套均可被 vm.Script 编译（语法层）；
 *   A2 combo 的 ruleOptionsEnable 键集与默认值与 Go 主版逐一相同；
 *   A3 Go-smart 的开关集 = Go 主版 ∪ 已知 Smart 增补集（增补集外的新键 → 失败；
 *      已知增补缺失 → 警告）；默认值在共享键上须一致；
 *   A4 无 Spark 夹具下，combo 与 Go 主版生成的组名集合相同（退化等价，生成级）；
 *   A5 Go-smart 与 Go 主版生成的组名集合相同（差异只允许出现在组 type 上，单独报告）。
 * 用法：node check_variant_consistency.js [脚本目录]
 * 退出码：A1/A2/A3(硬)/A4/A5 任一失败 → 1。层级：静态 + 配置生成级。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_DIR = process.argv[2] || path.join(__dirname, '..', '..', '01-baseline', '_work', 'target', 'Script');
const FILES = {
  go: path.join(SCRIPT_DIR, 'mihomoScriptGo.js'),
  smart: path.join(SCRIPT_DIR, 'mihomoScriptGo-smart.js'),
  combo: path.join(SCRIPT_DIR, 'mihomoScriptGo-combo.js'),
};
const KNOWN_SMART_EXTRA = ['Smart启用GBM模型', 'Smart优先ASN', 'Smart收集训练数据', 'Smart低倍率优先', '日志级别调试'];

let failures = 0;
const fail = (msg) => { console.log(`  FAIL ${msg}`); failures++; };
const ok = (msg) => console.log(`  ok   ${msg}`);
const warn = (msg) => console.log(`  warn ${msg}`);

function extractSwitches(code, label) {
  const anchor = code.indexOf('const ruleOptionsEnable = {');
  if (anchor < 0) throw new Error(`${label}: 未找到 ruleOptionsEnable 定义`);
  let depth = 0; let end = -1;
  for (let i = code.indexOf('{', anchor); i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const literal = code.slice(code.indexOf('{', anchor), end + 1);
  return vm.runInNewContext(`(${literal})`, {});
}

function runMain(code, input) {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.main(JSON.parse(JSON.stringify(input)));
}

const fixture = () => ({
  proxies: [
    { name: '🇭🇰 香港 01', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '美国 洛杉矶 01', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '日本 东京 01 0.2x', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
  ],
  'proxy-groups': [], rules: [],
});

const data = {};
for (const [key, file] of Object.entries(FILES)) {
  const code = fs.readFileSync(file, 'utf8');
  const sha = crypto.createHash('sha256').update(code).digest('hex');
  console.log(`== ${key}: ${path.basename(file)} sha256=${sha.slice(0, 12)}… 字节=${code.length}`);
  try { new vm.Script(code, { filename: path.basename(file) }); ok('A1 语法编译通过'); }
  catch (e) { fail(`A1 语法编译失败: ${e.message}`); continue; }
  data[key] = { code, switches: extractSwitches(code, key), sha };
  console.log(`     开关 ${Object.keys(data[key].switches).length} 个`);
}

if (data.go && data.combo) {
  const a = data.go.switches; const b = data.combo.switches;
  const keysA = Object.keys(a).sort(); const keysB = Object.keys(b).sort();
  if (JSON.stringify(keysA) !== JSON.stringify(keysB)) fail(`A2 combo 与 Go 开关键集不同: 仅 Go 有 [${keysA.filter((k) => !(k in b))}]，仅 combo 有 [${keysB.filter((k) => !(k in a))}]`);
  else {
    const diffDefault = keysA.filter((k) => a[k] !== b[k]);
    if (diffDefault.length) fail(`A2 combo 与 Go 默认值不同: ${diffDefault.map((k) => `${k}(Go=${a[k]}/combo=${b[k]})`).join(', ')}`);
    else ok(`A2 combo 开关集与默认值与 Go 逐一相同（${keysA.length} 键）`);
  }
}

if (data.go && data.smart) {
  const a = data.go.switches; const b = data.smart.switches;
  const extra = Object.keys(b).filter((k) => !(k in a));
  const missing = Object.keys(a).filter((k) => !(k in b));
  const unknownExtra = extra.filter((k) => !KNOWN_SMART_EXTRA.includes(k));
  if (missing.length) fail(`A3 Go-smart 缺失 Go 的开关: ${missing.join(', ')}`);
  if (unknownExtra.length) fail(`A3 Go-smart 出现已知增补集外的新开关: ${unknownExtra.join(', ')}（须先在 WP-1/WP-14 登记）`);
  const notYet = KNOWN_SMART_EXTRA.filter((k) => !(k in b));
  if (notYet.length) warn(`A3 已知 Smart 增补未出现: ${notYet.join(', ')}`);
  if (!missing.length && !unknownExtra.length) ok(`A3 Go-smart 开关集 = Go ∪ {${extra.join(', ')}}`);
  const diffDefault = Object.keys(a).filter((k) => k in b && a[k] !== b[k]);
  if (diffDefault.length) fail(`A3 共享开关默认值漂移: ${diffDefault.map((k) => `${k}(Go=${a[k]}/smart=${b[k]})`).join(', ')}`);
  else ok('A3 共享开关默认值一致');
}

if (data.go && data.combo) {
  const names = (out) => (out['proxy-groups'] || []).map((g) => g.name).sort();
  const goNames = names(runMain(data.go.code, fixture()));
  const comboNames = names(runMain(data.combo.code, fixture()));
  if (JSON.stringify(goNames) === JSON.stringify(comboNames)) ok(`A4 无 Spark 夹具下 combo 组名集合与 Go 相同（${goNames.length} 组，退化等价）`);
  else fail(`A4 combo 组名集合与 Go 不同: 仅 Go [${goNames.filter((n) => !comboNames.includes(n))}]，仅 combo [${comboNames.filter((n) => !goNames.includes(n))}]`);
  if (data.smart) {
    const smartOut = runMain(data.smart.code, fixture());
    const smartNames = names(smartOut);
    if (JSON.stringify(goNames) === JSON.stringify(smartNames)) ok('A5 Go-smart 组名集合与 Go 相同');
    else fail(`A5 Go-smart 组名集合与 Go 不同: 仅 Go [${goNames.filter((n) => !smartNames.includes(n))}]，仅 smart [${smartNames.filter((n) => !goNames.includes(n))}]`);
    const smartTypes = [...new Set(smartOut['proxy-groups'].map((g) => g.type))].sort();
    console.log(`     参考：Go-smart 组 type 分布 = ${smartTypes.join('/')}`);
  }
}

console.log(failures ? `\n结论：${failures} 条硬失败` : '\n结论：全部硬断言通过');
process.exit(failures ? 1 : 0);
