'use strict';
/* WP-14 原型 3b：跨引擎全脚本运行等价探针（R-012）。
 * 在当前引擎下加载 Go 主版、跑固定夹具，输出规范化 JSON 的 sha256 与结构计数。
 * 分别用 node（V8）与 bun（JavaScriptCore）运行并比对哈希：哈希一致 = 两引擎下
 * 生成行为逐字节等价（生成级证据）；不一致则 diff 定位。
 * 用法：node engine_fullrun.js [脚本路径]  /  bun engine_fullrun.js [脚本路径] */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = process.argv[2] || path.join(__dirname, '..', '..', '01-baseline', '_work', 'target', 'Script', 'mihomoScriptGo.js');
const code = fs.readFileSync(file, 'utf8');

const input = {
  proxies: [
    { name: '🇭🇰 香港 01', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '🇭🇰 香港 02 0.2x', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '美国 洛杉矶 01', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '日本 东京 01', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '新加坡 01 2x', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
    { name: '剩余流量 100GB', type: 'ss', server: '192.0.2.10', port: 1080, cipher: 'aes-128-gcm', password: 'synthetic-only' },
  ],
  'proxy-groups': [], rules: [],
};

let mainFn = null;
try {
  const vm = require('vm');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: path.basename(file) });
  mainFn = sandbox.main;
} catch (e) {
  console.log(`vm 路径失败（${e.message}），回退 eval 路径`);
}
if (typeof mainFn !== 'function') {
  (0, eval)(code + '\n;globalThis.__main = main;');
  mainFn = globalThis.__main;
}

const out = mainFn(JSON.parse(JSON.stringify(input)));
const canonical = JSON.stringify(out);
const sha = crypto.createHash('sha256').update(canonical).digest('hex');
const engine = typeof globalThis.Bun !== 'undefined' ? `bun ${Bun.version} (JavaScriptCore)` : `node ${process.version} (V8)`;
console.log(JSON.stringify({
  engine, file: path.basename(file),
  proxies: (out.proxies || []).length,
  groups: (out['proxy-groups'] || []).length,
  rules: (out.rules || []).length,
  providers: Object.keys(out['rule-providers'] || {}).length,
  outputSha256: sha,
}, null, 1));
