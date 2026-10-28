'use strict';
/* WP-14 原型 1（产品化自 WP-8 的 EXP-WP8-01 一次性校验脚本 + WP-6 的 EXP-INT-01 校验器）：
 * 引用完整性常设检查。对脚本 main() 的生成输出做结构断言：
 *   H1 规则目标可解析（节点/组/内置名）；H2 RULE-SET/rule-set: 引用 ⊆ rule-providers 键集；
 *   H3 组成员可解析；H4 组名/节点名无重复；H5 无空组；H6 dialer-proxy 指向存在；
 *   H7 组间引用无循环；H8 DNS 服务器 `#组名` 后缀指向存在的组；
 *   W1 default-selected 不在成员内（警告：wiki 语义回退首成员）；W2 孤儿 provider（警告）；
 *   W3 empty-fallback 非节点/内置名（警告：官方内核仅支持 proxy 名）。
 * 场景 S3/S4 的预期行为是 fail-fast 抛错（断言成立记 PASS-EXPECTED-THROW，不记错误）。
 * 用法：node check_references.js [脚本目录] [goal|smart|combo|all]
 * 退出码：存在 H 类失败 → 1；否则 0。输入全部为虚构节点（TEST-NET），无真实凭据。
 * 层级：配置生成级检查，不证明 mihomo 内核运行时行为。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_DIR = process.argv[2] || path.join(__dirname, '..', '..', '01-baseline', '_work', 'target', 'Script');
const WHICH = process.argv[3] || 'all';
const BUILTINS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL']);

const mk = (name, extra = {}) => ({
  name, type: 'ss', server: '192.0.2.10', port: 1080,
  cipher: 'aes-128-gcm', password: 'synthetic-only', ...extra,
});

const SCENARIOS = {
  S1_full: {
    expectThrow: false,
    input: () => ({
      proxies: [
        mk('🇭🇰 香港 01'), mk('🇭🇰 香港 02 0.2x'), mk('🇭🇰 香港 专线 2x'),
        mk('美国 洛杉矶 01'), mk('美国 纽约 01 0.5x'),
        mk('日本 东京 01'), mk('日本 大阪 01'),
        mk('新加坡 01'), mk('新加坡 02 2x'),
        mk('台湾 台北 01'),
        mk('剩余流量 100GB'), mk('官网 example.com'),
        mk('链式节点', { 'dialer-proxy': '🇭🇰 香港 01' }),
        mk('显式无UDP节点', { udp: false }),
      ],
      'proxy-groups': [], rules: [],
    }),
  },
  S2_hk_only: {
    expectThrow: false,
    input: () => ({ proxies: [mk('🇭🇰 香港 01'), mk('香港 02'), mk('🇭🇰 香港 03 0.2x')], 'proxy-groups': [], rules: [] }),
  },
  S3_empty: { expectThrow: true, input: () => ({ proxies: [], 'proxy-groups': [], rules: [] }) },
  S4_info_only: {
    expectThrow: true,
    input: () => ({ proxies: [mk('剩余流量 100GB'), mk('到期时间 2026-12-31'), mk('官网 example.com')], 'proxy-groups': [], rules: [] }),
  },
  S5_spark_mix: {
    expectThrow: false, onlyFor: 'combo',
    input: () => ({
      proxies: [
        mk('[Spark] 香港 专线 01'), mk('[Spark] 新加坡 专线 01'), mk('[Spark] 新加坡 0.2x 实验'),
        mk('[Spark] 美国 01'), mk('[Spark] 日本 01'), mk('[Spark] 英国 01'),
        mk('[吹雪] 日本 东京 01'), mk('[吹雪] 美国 01'), mk('🇭🇰 香港 普通 01'),
      ],
      'proxy-groups': [], rules: [],
    }),
  },
};

const disablePatch = (names) => (code) => {
  let c = code;
  for (const n of names) c = c.replace(new RegExp(`(${n}:\\s*)true`), '$1false');
  return c;
};
const EXTRA_RUNS = [
  { file: 'go', scenario: 'S6_go_svc_off', base: 'S1_full', patch: disablePatch(['Claude', 'AI', 'Cloudflare', 'AdBlock']) },
  { file: 'combo', scenario: 'S6b_combo_svc_off', base: 'S5_spark_mix', patch: disablePatch(['Claude', 'AI']) },
];

function loadMain(file, codePatch) {
  let code = fs.readFileSync(file, 'utf8');
  const sha = crypto.createHash('sha256').update(code).digest('hex').slice(0, 12);
  if (codePatch) code = codePatch(code);
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: path.basename(file) });
  return { main: sandbox.main, sha };
}

function ruleTarget(rule) {
  let r = rule;
  if (r.endsWith(',no-resolve')) r = r.slice(0, -',no-resolve'.length);
  if (/^(AND|OR|NOT),\(\(/.test(r)) {
    const idx = r.lastIndexOf('),');
    return r.slice(idx + 2);
  }
  const parts = r.split(',');
  return parts[parts.length - 1];
}

function check(file, scenarioName, scenario, codePatch) {
  const { main, sha } = loadMain(file, codePatch);
  const res = { file: path.basename(file), sha, scenario: scenarioName, errors: [], warnings: [], stats: {}, verdict: '' };
  let out;
  try {
    out = main(JSON.parse(JSON.stringify(scenario.input())));
  } catch (e) {
    if (scenario.expectThrow) { res.verdict = 'PASS-EXPECTED-THROW'; res.stats.thrown = e.message.slice(0, 80); }
    else { res.errors.push(`main() 意外抛错: ${e.message}`); res.verdict = 'FAIL'; }
    return res;
  }
  if (scenario.expectThrow) { res.errors.push('预期 fail-fast 抛错但 main() 正常返回'); res.verdict = 'FAIL'; return res; }

  const proxies = out.proxies || [];
  const groups = out['proxy-groups'] || [];
  const rules = out.rules || [];
  const providers = out['rule-providers'] || {};
  const proxyNames = new Set(proxies.map((p) => p.name));
  const groupNames = new Set(groups.map((g) => g.name));
  const providerNames = new Set(Object.keys(providers));
  res.stats = { proxies: proxies.length, groups: groups.length, rules: rules.length, providers: providerNames.size };
  const exists = (n) => proxyNames.has(n) || groupNames.has(n) || BUILTINS.has(n);

  const seenG = new Set();
  for (const g of groups) { if (seenG.has(g.name)) res.errors.push(`H4 重复组名: ${g.name}`); seenG.add(g.name); }
  const seenP = new Set();
  for (const p of proxies) { if (seenP.has(p.name)) res.errors.push(`H4 重复节点名: ${p.name}`); seenP.add(p.name); }

  for (const g of groups) {
    const members = g.proxies || [];
    if (members.length === 0) res.errors.push(`H5 空组: ${g.name}`);
    for (const m of members) if (!exists(m)) res.errors.push(`H3 组 ${g.name} 引用不存在的成员: ${m}`);
    if (g['default-selected'] !== undefined && !members.includes(g['default-selected'])) {
      res.warnings.push(`W1 组 ${g.name} 的 default-selected=${g['default-selected']} 不在成员中（回退首成员）`);
    }
    const ef = g['empty-fallback'];
    if (ef !== undefined && !(proxyNames.has(ef) || BUILTINS.has(ef))) {
      res.warnings.push(`W3 组 ${g.name} 的 empty-fallback=${ef} 不是节点/内置名`);
    }
  }

  const usedProviders = new Set();
  for (const rule of rules) {
    for (const m of rule.matchAll(/RULE-SET,([A-Za-z0-9_!@.\-]+)/g)) {
      usedProviders.add(m[1]);
      if (!providerNames.has(m[1])) res.errors.push(`H2 规则引用不存在的规则集: ${m[1]} ← ${rule.slice(0, 80)}`);
    }
    const target = ruleTarget(rule);
    if (target && !exists(target)) res.errors.push(`H1 规则目标不存在: ${target} ← ${rule.slice(0, 80)}`);
  }
  const dns = out.dns || {};
  const dnsStr = JSON.stringify(dns);
  for (const m of dnsStr.matchAll(/rule-set:([A-Za-z0-9_!@.\-]+)/g)) {
    usedProviders.add(m[1]);
    if (!providerNames.has(m[1])) res.errors.push(`H2 DNS 引用不存在的规则集: ${m[1]}`);
  }
  // H8: DNS 服务器 `#组名` 后缀（如 #默认代理）须指向存在的组；#DIRECT 为内置
  for (const key of ['nameserver', 'default-nameserver', 'proxy-server-nameserver', 'direct-nameserver']) {
    for (const srv of dns[key] || []) {
      const m = String(srv).match(/#(.+)$/);
      if (m && m[1] !== 'DIRECT' && !groupNames.has(m[1])) res.errors.push(`H8 dns.${key} 后缀组不存在: ${srv}`);
    }
  }
  for (const p of providerNames) if (!usedProviders.has(p)) res.warnings.push(`W2 孤儿规则集: ${p}`);

  for (const p of proxies) {
    if (p['dialer-proxy'] && !exists(p['dialer-proxy'])) res.errors.push(`H6 节点 ${p.name} 的 dialer-proxy 指向不存在: ${p['dialer-proxy']}`);
  }

  const gmap = new Map(groups.map((g) => [g.name, (g.proxies || []).filter((m) => groupNames.has(m))]));
  const state = new Map(); const stack = [];
  const dfs = (n) => {
    state.set(n, 1); stack.push(n);
    for (const nxt of gmap.get(n) || []) {
      if (state.get(nxt) === 1) res.errors.push(`H7 组循环引用: ${[...stack, nxt].join(' → ')}`);
      else if (!state.get(nxt)) dfs(nxt);
    }
    stack.pop(); state.set(n, 2);
  };
  for (const n of groupNames) if (!state.get(n)) dfs(n);

  res.verdict = res.errors.length ? 'FAIL' : 'PASS';
  return res;
}

const FILES = {
  go: path.join(SCRIPT_DIR, 'mihomoScriptGo.js'),
  smart: path.join(SCRIPT_DIR, 'mihomoScriptGo-smart.js'),
  combo: path.join(SCRIPT_DIR, 'mihomoScriptGo-combo.js'),
};

const results = [];
for (const [key, file] of Object.entries(FILES)) {
  if (WHICH !== 'all' && WHICH !== key) continue;
  if (!fs.existsSync(file)) { console.error(`缺失文件: ${file}`); process.exit(2); }
  for (const [sname, scenario] of Object.entries(SCENARIOS)) {
    if (scenario.onlyFor && scenario.onlyFor !== key) continue;
    results.push(check(file, sname, scenario));
  }
}
for (const run of EXTRA_RUNS) {
  if (WHICH !== 'all' && WHICH !== run.file) continue;
  results.push(check(FILES[run.file], run.scenario, SCENARIOS[run.base], run.patch));
}

let hardFail = 0;
for (const r of results) {
  console.log(`[${r.verdict}] ${r.file}@${r.sha} ${r.scenario} ${JSON.stringify(r.stats)}`);
  for (const e of r.errors) { console.log(`    ERROR ${e}`); hardFail++; }
  for (const w of r.warnings) console.log(`    warn  ${w}`);
}
console.log(`\n合计 ${results.length} 次运行，H 类失败 ${hardFail} 条。`);
process.exit(hardFail ? 1 : 0);
