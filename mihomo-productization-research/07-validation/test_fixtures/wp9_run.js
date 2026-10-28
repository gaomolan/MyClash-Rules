'use strict';
/* WP-9 隔离实验运行器：以人工构造的虚构节点（RFC 5737 文档网段）运行真实脚本 main()，
   逐项比对夹具中先行写入的期望。原仓库只读；输入/输出均为合成数据。
   用法: node wp9_run.js <workRoot> <fixture.json> <results.json> */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const [workRoot, fixturePath, resultsPath] = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const variantPaths = fixture.meta.variants;

const invisible = /[\u00AD\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u115F\u1160\u3164\uFFA0]/g;
const flagPair = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const stripName = (s) =>
  String(s).replace(flagPair, '').replace(invisible, '').replace(/\s+/g, ' ').trim();

function loadVariant(variant, switches) {
  const file = path.join(workRoot, variantPaths[variant]);
  let code = fs.readFileSync(file, 'utf8');
  const entries = Object.entries(switches || {});
  if (entries.length) {
    const start = code.indexOf('const ruleOptionsEnable = {');
    if (start < 0) throw new Error(`${variant}: ruleOptionsEnable 未找到`);
    const end = code.indexOf('\n};', start);
    let block = code.slice(start, end);
    for (const [k, v] of entries) {
      const needle = `${k}:`;
      const i = block.indexOf(needle);
      if (i < 0) throw new Error(`${variant}: 开关 ${k} 未找到`);
      const j = block.indexOf(',', i);
      block = block.slice(0, i) + `${k}: ${v}` + block.slice(j);
    }
    code = code.slice(0, start) + block + code.slice(end);
  }
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: variantPaths[variant] });
  if (typeof sandbox.main !== 'function') throw new Error(`${variant}: main 不是函数`);
  return sandbox.main;
}

function membership(out) {
  const map = new Map();
  for (const g of out['proxy-groups'] || []) {
    for (const m of g.proxies || []) {
      if (typeof m !== 'string') continue;
      if (!map.has(m)) map.set(m, new Set());
      map.get(m).add(g.name);
    }
  }
  return map;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function evalSuite(suite) {
  const res = { id: suite.id, title: suite.title, variant: suite.variant, cases: [], suiteFailures: [] };
  let mainFn;
  try {
    mainFn = loadVariant(suite.variant, suite.switches);
  } catch (e) {
    res.suiteFailures.push(`加载失败: ${e.message}`);
    return res;
  }
  const proxies = (suite.nodes || []).map((n, i) => ({
    name: n.name,
    type: 'ss',
    server: '203.0.113.10',
    port: 10000 + i,
    cipher: 'aes-128-gcm',
    password: 'synthetic',
    ...(n.extra || {}),
  }));
  const config = suite.omitProxies ? { 'proxy-groups': [], rules: [] } : { proxies, 'proxy-groups': [], rules: [] };
  let out = null;
  let err = null;
  try {
    out = mainFn(config);
  } catch (e) {
    err = e;
  }
  if (suite.expectErrorContains) {
    const ok = !!err && String(err.message).includes(suite.expectErrorContains);
    res.cases.push({
      name: '(suite) 应抛错',
      pass: ok,
      failures: ok ? [] : [`期望抛错含「${suite.expectErrorContains}」，实际: ${err ? err.message : '未抛错'}`],
      actual: { error: err ? String(err.message) : null },
    });
    return res;
  }
  if (err) {
    res.suiteFailures.push(`运行抛错: ${err.message}`);
    return res;
  }
  const member = membership(out);
  const outProxies = out.proxies || [];
  const groupNames = new Set((out['proxy-groups'] || []).map((g) => g.name));
  for (const gp of suite.expectGroupsPresent || []) {
    if (!groupNames.has(gp)) res.suiteFailures.push(`期望存在的组缺失: ${gp}`);
  }
  for (const ga of suite.expectGroupsAbsent || []) {
    if (groupNames.has(ga)) res.suiteFailures.push(`期望不存在的组出现: ${ga}`);
  }
  (suite.nodes || []).forEach((n, i) => {
    const exp = n.expect || {};
    const c = { name: n.name, pass: true, failures: [], actual: {} };
    const wantServer = (exp.fields && exp.fields.server) || (n.extra && n.extra.server);
    let cands = outProxies.filter((p) => stripName(p.name) === stripName(n.name));
    let hit = null;
    if (wantServer) hit = cands.find((p) => p.server === wantServer) || null;
    else if (exp.renamedTo) hit = cands.find((p) => p.name === exp.renamedTo) || cands[0] || null;
    else hit = cands.find((p) => p.name === n.name) || cands[0] || null;
    const survives = !!hit;
    c.actual.survives = survives;
    if (hit) {
      c.actual.outputName = hit.name;
      c.actual.groups = [...(member.get(hit.name) || [])];
    }
    if (exp.survives !== undefined && exp.survives !== survives) {
      c.failures.push(`存活期望 ${exp.survives}，实际 ${survives}`);
    }
    if (survives && hit) {
      const groups = member.get(hit.name) || new Set();
      for (const g of exp.regionGroups || []) {
        if (!groups.has(g)) c.failures.push(`应属组「${g}」但不在（实际组: ${[...groups].join('/') || '无'}）`);
      }
      for (const g of exp.notInGroups || []) {
        if (groups.has(g)) c.failures.push(`不应属组「${g}」但在其中`);
      }
      if (exp.inOther && !groups.has('其他节点')) c.failures.push('应在「其他节点」组但不在');
      if (exp.inEcoOf && !groups.has(`${exp.inEcoOf}-Eco-Auto`)) {
        c.failures.push(`应在「${exp.inEcoOf}-Eco-Auto」但不在`);
      }
      if (exp.notEco && [...groups].some((g) => g.endsWith('-Eco-Auto'))) {
        c.failures.push(`不应进入 Eco-Auto，但在: ${[...groups].filter((g) => g.endsWith('-Eco-Auto')).join('/')}`);
      }
      if (exp.renamedTo !== undefined && hit.name !== exp.renamedTo) {
        c.failures.push(`改名期望「${exp.renamedTo}」，实际「${hit.name}」`);
      }
      if (exp.nameContains !== undefined && !hit.name.includes(exp.nameContains)) {
        c.failures.push(`输出名应包含 U+${exp.nameContains.codePointAt(0).toString(16).toUpperCase()}，实际名码点: ${[...hit.name].map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase()).join(' ')}`);
      }
      if (exp.fields) {
        for (const [k, v] of Object.entries(exp.fields)) {
          if (!deepEqual(hit[k], v)) c.failures.push(`字段 ${k} 期望 ${JSON.stringify(v)}，实际 ${JSON.stringify(hit[k])}`);
        }
      }
      for (const k of exp.fieldAbsent || []) {
        if (k in hit) c.failures.push(`字段 ${k} 应缺失，实际存在: ${JSON.stringify(hit[k])}`);
      }
      if (exp.dialerProxy !== undefined) {
        const dp = hit['dialer-proxy'];
        if (exp.dialerProxy === null && dp !== undefined) c.failures.push(`dialer-proxy 应被删除，实际: ${dp}`);
        if (typeof exp.dialerProxy === 'string' && dp !== exp.dialerProxy) {
          c.failures.push(`dialer-proxy 期望「${exp.dialerProxy}」，实际「${dp}」`);
        }
      }
    }
    c.pass = c.failures.length === 0;
    res.cases.push(c);
  });
  res.pass = res.suiteFailures.length === 0 && res.cases.every((c) => c.pass);
  return res;
}

// S9 规模/性能（合成生成，非夹具文件内）
function scaleTest() {
  const mainFn = loadVariant('go', {});
  const regions = ['香港', '日本', '美国', '新加坡', '台湾'];
  const mk = (n) =>
    Array.from({ length: n }, (_, i) => ({
      name: `${regions[i % 5]} 节点${i} ${i % 7 === 0 ? '0.2x' : i % 11 === 0 ? '2x' : ''}`.trim(),
      type: 'ss', server: '203.0.113.10', port: 10000 + (i % 5000),
      cipher: 'aes-128-gcm', password: 'synthetic',
    }));
  const rows = [];
  for (const n of [200, 2000]) {
    const cfg = { proxies: mk(n), 'proxy-groups': [], rules: [] };
    const t0 = process.hrtime.bigint();
    const out = mainFn(cfg);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    rows.push({ n, ms: Math.round(ms * 10) / 10, outProxies: out.proxies.length, groups: (out['proxy-groups'] || []).length });
  }
  return rows;
}

const results = { generatedAt: new Date().toISOString(), node: process.version, suites: [] };
for (const suite of fixture.suites) results.suites.push(evalSuite(suite));
try {
  results.scale = scaleTest();
} catch (e) {
  results.scale = [{ error: e.message }];
}
fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

let pass = 0, fail = 0;
for (const s of results.suites) {
  for (const f of s.suiteFailures) console.log(`[${s.id}] SUITE-FAIL: ${f}`);
  for (const c of s.cases) {
    if (c.pass) pass++;
    else {
      fail++;
      console.log(`[${s.id}] FAIL ${JSON.stringify(c.name)} :: ${c.failures.join('；')}`);
    }
  }
}
console.log(`\n用例通过 ${pass}，失败 ${fail}；规模: ${JSON.stringify(results.scale)}`);
