'use strict';
/* WP-9 正则单元测试：从各变体真实代码中导出 regionDefinitions / rateRegionDefinitions /
   excludeFilter 本体，对照「设计意图」逐条验证（意图≠代码现状，分歧即误判/漏识别证据）。
   Go 系匹配前经 toMatchableName 剥离不可见字符（与 getMatchedRegions 实现一致）；
   旧 Smart 无 toMatchableName，直接测原始名。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const workRoot = process.argv[2];
const outPath = process.argv[3];
const FILES = {
  go: 'target/Script/mihomoScriptGo.js',
  'old-smart': 'target/Script/mihomoScript-smart.js',
  custom: 'target/Script/mihomoScript-custom.js',
};
const HOOK = `\n;globalThis.__x = {
  rd: (typeof regionDefinitions !== 'undefined' ? regionDefinitions : null),
  rrd: (typeof rateRegionDefinitions !== 'undefined' ? rateRegionDefinitions : null),
  ex: (typeof excludeFilter !== 'undefined' ? excludeFilter : null),
  tm: (typeof toMatchableName === 'function' ? toMatchableName : null),
};`;

function loadDefs(variant) {
  const code = fs.readFileSync(path.join(workRoot, FILES[variant]), 'utf8') + HOOK;
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: FILES[variant] });
  return sb.__x;
}

const CASES = [
  // target: HK/JP/US/SG/TW 索引 0..4；LOW/HIGH 倍率；EXCLUDE 信息词
  ['HK', '香港 01', true, '正例', ''],
  ['HK', 'HKG 01', true, '正例', ''],
  ['HK', 'hongkong-01', true, '正例', ''],
  ['HK', '东京 01', false, '负例', ''],
  ['HK', '伦敦 01', false, '负例', ''],
  ['JP', '东京 01', true, '正例', ''],
  ['JP', 'JPN 01', true, '正例', ''],
  ['JP', 'japan 01', true, '正例', ''],
  ['JP', 'Tokyo 01', true, '正例', '英文城市名不在正则内，预期漏识别'],
  ['JP', 'Osaka 01', true, '正例', '英文城市名不在正则内，预期漏识别'],
  ['US', '美国 01', true, '正例', ''],
  ['US', 'USA 01', true, '正例', ''],
  ['US', '洛杉矶 01', true, '正例', ''],
  ['US', '美國 01', true, '正例', '繁体字形不在正则内，预期漏识别'],
  ['US', 'Los Angeles 01', true, '正例', '英文城市名不在正则内，预期漏识别'],
  ['US', 'Russia 01', false, '负例', 'us 子串被字母边界后顾拦截'],
  ['US', '圣地亚哥 01', null, '争议例', '旧版名单内；Go 已主动移除（圣地亚哥亦为智利首都名）'],
  ['SG', '新加坡 01', true, '正例', ''],
  ['SG', 'SGP 01', true, '正例', ''],
  ['SG', '狮城 01', true, '正例', ''],
  ['SG', '吉隆坡 01', false, '负例', ''],
  ['TW', '台北 01', true, '正例', ''],
  ['TW', 'TWN 01', true, '正例', ''],
  ['TW', 'hinet 01', true, '正例', ''],
  ['TW', '新北 01', true, '正例', '旧版/上游名单无新北，预期仅 Go 命中'],
  ['TW', '台灣 01', true, '正例', '繁体字形不在正则内，预期漏识别'],
  ['TW', '台中 01', true, '正例', '城市名单外，预期漏识别'],
  ['LOW', '香港 0.2x', true, '正例', ''],
  ['LOW', '香港 0.5倍', true, '正例', '0.5 为含边界'],
  ['LOW', '香港 x0.2', true, '正例', ''],
  ['LOW', '香港 低倍专线', true, '正例', ''],
  ['LOW', '香港 免费节点', true, '正例', ''],
  ['LOW', '香港 Free 01', true, '正例', ''],
  ['LOW', '香港 下载专线', true, '正例', '设计即如此：将下载类节点归入低倍率（语义借用）'],
  ['LOW', '香港 0倍', true, '正例', ''],
  ['LOW', '香港 0.6x', false, '负例', '0.6-1.0 为标准倍率空档'],
  ['LOW', '香港 1x', false, '负例', ''],
  ['LOW', '香港 剩余0.5倍', false, '负例', '负向前瞻（剩/期）守卫'],
  ['LOW', '香港 客户端下载', false, '负例', '负向前瞻（客户端/软件）守卫'],
  ['LOW', '香港 Freedom 01', false, '负例', 'free 词边界'],
  ['LOW', '香港 10.5x', false, '负例', '小数点后顾防误吞 0.5'],
  ['LOW', '香港 x86 优化', false, '负例', '预期误判：x+两位数字被当作高倍率符号式，低倍率侧亦需确认不命中'],
  ['LOW', '香港 v0.5 测试', false, '负例', '预期误判：版本号 0.5 被当作低倍率'],
  ['LOW', '香港 0.55x', false, '负例', '预期边界误判：0.55>0.5 仍被前缀匹配 0.5'],
  ['HIGH', '香港 2x', true, '正例', ''],
  ['HIGH', '香港 2倍', true, '正例', ''],
  ['HIGH', '香港 ×3', true, '正例', ''],
  ['HIGH', '香港 1.5倍', true, '正例', '预期分叉：Go 支持 1.x 小数倍率，上游系仅整数≥2'],
  ['HIGH', '香港 1.1x', true, '正例', '预期分叉：同上'],
  ['HIGH', '香港 10.5x', true, '正例', ''],
  ['HIGH', '香港 20.5倍', true, '正例', ''],
  ['HIGH', '香港 1x', false, '负例', '1.0 为标准倍率'],
  ['HIGH', '香港 1.0倍', false, '负例', ''],
  ['HIGH', '香港 0.5x', false, '负例', ''],
  ['HIGH', '香港 x86 优化', false, '负例', '预期误判：架构标识 x86 被当作 ×86 倍率'],
  ['HIGH', '香港 到期2倍', false, '负例', '预期误判：高倍率正则无信息词守卫'],
  ['HIGH', '香港 v2 节点', false, '负例', '数字后无倍率符号'],
  ['EXCLUDE', '剩余流量 100GB', true, '正例', ''],
  ['EXCLUDE', '官网地址 example', true, '正例', ''],
  ['EXCLUDE', '频道 t.me/+abc123', true, '正例', ''],
  ['EXCLUDE', '⚠️ 系统维护通知', true, '正例', ''],
  ['EXCLUDE', 'example.com 01', true, '正例', '.com 命中'],
  ['EXCLUDE', '公益节点 01', true, '正例', '按词表设计命中；语义上可能是真实节点，存在误删风险'],
  ['EXCLUDE', '香港 01', false, '负例', ''],
  ['EXCLUDE', '自建中转 01', false, '负例', ''],
  ['EXCLUDE', '美国专线 01', false, '负例', ''],
];

const REGION_IDX = { HK: 0, JP: 1, US: 2, SG: 3, TW: 4 };
const defs = {};
for (const v of Object.keys(FILES)) defs[v] = loadDefs(v);

function testOne(variant, target, name) {
  const d = defs[variant];
  const probe = d.tm ? d.tm(name) : name;
  if (target === 'EXCLUDE') return d.ex.test(probe);
  if (target === 'LOW' || target === 'HIGH') {
    const def = d.rrd.find((r) => (target === 'LOW' ? r.name.includes('低倍') : r.name.includes('高倍')));
    return def.regex.test(probe);
  }
  return d.rd[REGION_IDX[target]].regex.test(probe);
}

const rows = CASES.map(([target, name, intent, type, note]) => {
  const row = { target, name, intent, type, note };
  for (const v of Object.keys(FILES)) row[v] = testOne(v, target, name);
  return row;
});
const patterns = {};
for (const v of Object.keys(FILES)) {
  const d = defs[v];
  patterns[v] = {
    regions: d.rd.map((r) => ({ name: r.name, source: r.regex.source })),
    low: d.rrd.find((r) => r.name.includes('低倍')).regex.source,
    high: d.rrd.find((r) => r.name.includes('高倍')).regex.source,
    exclude: d.ex.source,
    hasToMatchableName: !!d.tm,
  };
}
fs.writeFileSync(outPath, JSON.stringify({ rows, patterns }, null, 2));
let div = 0;
for (const r of rows) {
  const marks = Object.keys(FILES).map((v) => `${v}=${r[v]}`).join(' ');
  const flag = r.intent === null ? '（争议）' : Object.keys(FILES).some((v) => r[v] !== r.intent) ? '≠意图' : 'ok';
  if (flag === '≠意图') div++;
  console.log(`${r.target.padEnd(7)} ${JSON.stringify(r.name)} 意图=${r.intent} ${marks} ${flag}${r.note ? ' :: ' + r.note : ''}`);
}
console.log(`\n共 ${rows.length} 条，与设计意图分歧 ${div} 条（至少一变体）`);
