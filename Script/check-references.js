// ============================================================
// 引用完整性全检（A1，2026-11-07）：对脚本 main() 的生成配置做交叉核对——
//   1. 策略组名不重复；
//   2. 组内成员（proxies）必须存在：组、节点或内置目标；
//   3. default-selected 必须落在该组成员内；
//   4. 每条规则的目标组必须存在；规则引用的 RULE-SET 必须有对应 provider；
//   5. 每个 provider 必须被至少一处引用（规则 / DNS policy / fake-ip-filter），
//      孤儿 provider 意味着每天白下载一份规则集；
//   6. DNS nameserver-policy 与 fake-ip-filter 引用的 rule-set 必须存在。
//
// 用法：node Script/check-references.js [脚本文件...]
//   缺省检查同目录的 mihomoScriptGo.js 与 mihomoScriptGo-combo.js。
//   环境变量 MIHOMO_BIN 指向 mihomo 二进制时，额外把每份生成配置
//   写成临时文件跑一遍真内核 -t 解析门禁（A6）。
// 退出码：发现违规为 1，全部通过为 0。
// ============================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const BUILTINS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL']);

// ---- 夹具订阅：覆盖多地区/倍率/零宽字符/同名/链式/信息节点/私有 DNS ----
function fixtureRich() {
  return {
    proxies: [
      { name: '🇭🇰 香港 01', type: 'ss', server: 'hk1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: 'H​KG 02 0.5x', type: 'ss', server: 'hk2.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '🇺🇸 美国 洛杉矶 2x', type: 'ss', server: 'us1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '🇯🇵 日本 东京', type: 'ss', server: 'jp1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '🇸🇬 新加坡 下载专用', type: 'ss', server: 'sg1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '🇹🇼 台湾 台北', type: 'ss', server: 'tw1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '中转 香港 01', type: 'ss', server: 'hk1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x', 'dialer-proxy': '🇭🇰 香港 01' },
      { name: '剩余流量 100G 到期 2026-12-01', type: 'ss', server: 'info.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '冷门 冰岛', type: 'ss', server: 'is1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    ],
    dns: {
      nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query', 'https://private-dns.example.com/dns-query'],
      'proxy-server-nameserver': ['https://private-dns.example.com/dns-query'],
      'nameserver-policy': { '+.example.com': 'https://private-dns.example.com/dns-query' },
    },
    hosts: { 'hk1.example.com': '203.0.113.10' },
  };
}
function fixtureMinimal() {
  return {
    proxies: [
      { name: '香港 A', type: 'ss', server: 'a.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      { name: '美国 B', type: 'ss', server: 'b.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    ],
  };
}

function loadMain(scriptPath) {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  return vm.runInContext(`${src}\n;main;`, sandbox, { filename: scriptPath });
}

function checkConfig(cfg, label, problems) {
  const groups = cfg['proxy-groups'] || [];
  const groupNames = new Set();
  for (const g of groups) {
    if (groupNames.has(g.name)) problems.push(`${label}: 策略组重名 ${g.name}`);
    groupNames.add(g.name);
  }
  const nodeNames = new Set((cfg.proxies || []).map((p) => p.name));
  const providers = cfg['rule-providers'] || {};
  const providerNames = new Set(Object.keys(providers));
  const usedProviders = new Set();
  const exists = (name) => groupNames.has(name) || nodeNames.has(name) || BUILTINS.has(name);

  for (const g of groups) {
    for (const member of g.proxies || []) {
      if (!exists(member)) problems.push(`${label}: 组 ${g.name} 成员不存在: ${member}`);
    }
    const sel = g['default-selected'];
    if (sel !== undefined && !(g.proxies || []).includes(sel)) {
      problems.push(`${label}: 组 ${g.name} 的 default-selected 不在成员内: ${sel}`);
    }
  }

  const ruleTarget = (rule) => {
    if (rule.startsWith('MATCH,')) return rule.split(',')[1];
    if (/^(AND|OR|NOT),/.test(rule)) {
      const idx = rule.lastIndexOf('),');
      return idx >= 0 ? rule.slice(idx + 2) : null;
    }
    const parts = rule.split(',');
    return parts.length >= 3 ? parts[2] : null;
  };
  for (const rule of cfg.rules || []) {
    for (const m of rule.matchAll(/RULE-SET,([A-Za-z0-9_@.\-!]+)/g)) {
      if (!providerNames.has(m[1])) problems.push(`${label}: 规则引用不存在的 provider: ${m[1]}（${rule}）`);
      usedProviders.add(m[1]);
    }
    const target = ruleTarget(rule);
    if (target && !exists(target)) problems.push(`${label}: 规则目标不存在: ${target}（${rule}）`);
  }

  const dns = cfg.dns || {};
  for (const key of Object.keys(dns['nameserver-policy'] || {})) {
    if (key.startsWith('rule-set:')) {
      const name = key.slice('rule-set:'.length);
      if (!providerNames.has(name)) problems.push(`${label}: nameserver-policy 引用不存在的 provider: ${name}`);
      usedProviders.add(name);
    }
  }
  for (const entry of dns['fake-ip-filter'] || []) {
    if (typeof entry === 'string' && entry.startsWith('rule-set:')) {
      const name = entry.slice('rule-set:'.length);
      if (!providerNames.has(name)) problems.push(`${label}: fake-ip-filter 引用不存在的 provider: ${name}`);
      usedProviders.add(name);
    }
  }

  for (const name of providerNames) {
    if (!usedProviders.has(name)) problems.push(`${label}: 孤儿 provider（定义了但无人引用）: ${name}`);
  }
}

function kernelGate(cfg, label, problems) {
  const bin = process.env.MIHOMO_BIN;
  if (!bin) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mihomo-gate-'));
  try {
    fs.writeFileSync(path.join(dir, 'config.yaml'), JSON.stringify(cfg));
    // IP-ASN 规则会让内核在解析期加载 ASN.mmdb；有本地副本时预置，避免它联网下载
    const mmdb = process.env.ASN_MMDB || path.join(os.homedir(), 'workspace/script-defense-review/ASN.mmdb');
    if (fs.existsSync(mmdb)) fs.copyFileSync(mmdb, path.join(dir, 'ASN.mmdb'));
    execFileSync(bin, ['-t', '-d', dir], { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    problems.push(`${label}: 真内核 -t 未通过: ${String(e.stderr || e.message).slice(0, 300)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const files = process.argv.slice(2);
const targets = files.length
  ? files
  : [path.join(__dirname, 'mihomoScriptGo.js'), path.join(__dirname, 'mihomoScriptGo-combo.js')];

let failed = 0;
for (const file of targets) {
  const main = loadMain(file);
  const problems = [];
  for (const [fxName, fx] of [['rich', fixtureRich], ['minimal', fixtureMinimal]]) {
    const cfg = main(structuredClone(fx()));
    const label = `${path.basename(file)}/${fxName}`;
    checkConfig(cfg, label, problems);
    kernelGate(cfg, label, problems);
  }
  if (problems.length) {
    failed = 1;
    console.log(`✗ ${path.basename(file)}`);
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log(`✓ ${path.basename(file)}（rich/minimal 两夹具全检通过${process.env.MIHOMO_BIN ? '，含真内核 -t' : ''}）`);
  }
}
process.exit(failed);
