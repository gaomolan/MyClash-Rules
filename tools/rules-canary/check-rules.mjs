#!/usr/bin/env node
/**
 * 规则存活巡检（rules canary）
 *
 * 做什么：用仓库 Test 同款的 vm 加载方式，实际运行三件套覆写脚本
 * （mihomoScriptGo / -smart / -combo）的 main()，从「生成出来的配置」里
 * 收集全部远程依赖 URL——rule-providers、geox-url 地理库、策略组图标——
 * 逐个探活。任一 URL 最终不可达即以退出码 1 结束，供 GitHub Actions 报警。
 *
 * 为什么从生成配置取 URL：脚本里大量 URL 由基地址模板拼装，静态 grep
 * 拼不全；跑一遍生成逻辑拿到的才是运行时真实依赖，且脚本改了巡检自动跟随。
 *
 * 为什么有复检：镜像站（jsdmirror 等）会出现分钟级抖动（实测同一文件
 * 403 后数分钟恢复）。首轮失败的 URL 统一等待后复检一次，复检仍失败
 * 才算真失败，避免抖动误报。
 *
 * 本地运行：仓库根目录执行 `node tools/rules-canary/check-rules.mjs`
 * 可选参数：--timeout <毫秒>（默认 15000）、--retry-delay <毫秒>（默认 30000）
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = [
  'Script/mihomoScriptGo.js',
  'Script/mihomoScriptGo-smart.js',
  'Script/mihomoScriptGo-combo.js',
];
function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
}
const TIMEOUT_MS = argValue('--timeout', 15000);
const RETRY_DELAY_MS = argValue('--retry-delay', 30000);

/** 与 Test/lib/loader.js 相同的加载方式：vm 沙箱执行脚本并导出 main */
function loadMain(scriptRelPath) {
  const code = fs.readFileSync(path.join(ROOT, scriptRelPath), 'utf8');
  const sandbox = {
    module: { exports: {} },
    console,
    process,
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\n;module.exports = { main };', sandbox, {
    filename: path.basename(scriptRelPath),
  });
  return sandbox.module.exports.main;
}

/** 最小合成订阅：两个不同地区节点，足够让脚本生成完整分组与规则集 */
function sampleConfig() {
  return {
    proxies: [
      { name: '香港 01', type: 'vless', server: 'hk.example.com', port: 443 },
      { name: '新加坡 01', type: 'ss', server: 'sg.example.com', port: 8388 },
    ],
    'proxy-groups': [],
    rules: [],
  };
}

/** 从一份生成配置里收集全部远程依赖 URL（按类别） */
function collectUrls(config) {
  const found = new Map(); // url -> 类别
  const add = (url, kind) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) found.set(url.split('#')[0], kind);
  };
  for (const provider of Object.values(config['rule-providers'] || {})) {
    add(provider && provider.url, '规则集');
  }
  for (const url of Object.values(config['geox-url'] || {})) add(url, '地理库');
  for (const group of config['proxy-groups'] || []) add(group && group.icon, '图标');
  return found;
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { Range: 'bytes=0-0', 'User-Agent': 'rules-canary' },
    });
    // 读掉少量 body 即释放连接，避免大文件全量下载
    try { await res.body?.cancel(); } catch { /* 忽略 */ }
    return res.status;
  } catch (err) {
    return `ERR ${err.name === 'AbortError' ? 'Timeout' : err.message}`;
  } finally {
    clearTimeout(timer);
  }
}

const isOk = (status) => typeof status === 'number' && status >= 200 && status < 400;

async function probeAll(entries) {
  const results = new Map();
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const [url, kind] = entries[cursor++];
      const status = await probe(url);
      results.set(url, { kind, status });
      console.log(`${isOk(status) ? '✓' : '✗'} [${kind}] ${status}  ${url}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return results;
}

async function main() {
  const all = new Map();
  for (const rel of SCRIPTS) {
    let mainFn;
    try {
      mainFn = loadMain(rel);
    } catch (err) {
      console.error(`✗ ${rel} 加载失败：${err.message}`);
      process.exitCode = 1;
      continue;
    }
    let out;
    try {
      out = mainFn(sampleConfig(), {});
    } catch (err) {
      console.error(`✗ ${rel} 生成配置失败：${err.message}`);
      process.exitCode = 1;
      continue;
    }
    for (const [url, kind] of collectUrls(out)) {
      if (!all.has(url)) all.set(url, kind);
    }
    console.log(`✓ ${rel}：生成配置成功`);
  }

  const urls = [...all.entries()];
  console.log(`\n共收集到 ${urls.length} 个远程依赖 URL，开始探活（并发 6）…`);
  const first = await probeAll(urls);
  let failures = urls.filter(([url]) => !isOk(first.get(url).status));

  if (failures.length > 0) {
    console.log(`\n首轮 ${failures.length} 个 URL 失败，等待 ${RETRY_DELAY_MS / 1000}s 后复检（过滤镜像抖动）…`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    const second = await probeAll(failures);
    failures = failures.filter(([url]) => !isOk(second.get(url).status));
    for (const [url] of failures) first.get(url).status = second.get(url).status;
  }

  if (failures.length > 0) {
    console.error(`\n巡检失败：${failures.length} 个 URL 复检后仍不可达：`);
    for (const [url, kind] of failures) console.error(`  - [${kind}] ${first.get(url).status}  ${url}`);
    process.exitCode = 1;
  } else {
    console.log(`\n巡检通过：${urls.length} 个 URL 全部存活。`);
  }
}

main().catch((err) => {
  console.error('巡检脚本自身异常：', err);
  process.exitCode = 1;
});
