'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const TARGETS = [['Go main', path.join(ROOT, 'Script/mihomoScriptGo.js')], ['Combo generated', path.join(ROOT, 'Script/mihomoScriptGo-combo.js')]];

function loadApi(file, patch = {}) {
  const sandbox = { console };
  vm.createContext(sandbox);
  let source = fs.readFileSync(file, 'utf8');
  // prefixRules is built during script evaluation, so test switches must be patched before evaluation.
  for (const [key, value] of Object.entries(patch)) {
    const enabled = key + ': ' + value + ',';
    const disabled = key + ': ' + (!value) + ',';
    if (source.includes(enabled)) continue;
    const count = source.split(disabled).length - 1;
    if (count !== 1) throw new Error('Cannot patch option ' + key + '; found ' + count + ' default anchors');
    source = source.replace(disabled, enabled);
  }
  return vm.runInContext(source + '\n;({ main, ruleOptionsEnable });', sandbox, { filename: file });
}

function fixture() {
  return { proxies: [
    { name: '🇭🇰 香港 01', type: 'ss', server: 'hk1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '🇺🇸 美国 01', type: 'ss', server: 'us1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '🇯🇵 日本 01', type: 'ss', server: 'jp1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
    { name: '🇸🇬 新加坡 01', type: 'ss', server: 'sg1.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
  ] };
}
function output(file, patch = {}) {
  const api = loadApi(file, patch);
  return { api, config: api.main(fixture()) };
}
function idx(rules, value) { return rules.indexOf(value); }
function assertOrder(label, rules) {
  const proc=idx(rules,'PROCESS-NAME,com.mobiletools.systemhelper,REJECT');
  const dom=idx(rules,'DOMAIN,dm.wo.com.cn,REJECT');
  const priv=idx(rules,'RULE-SET,private,直连');
  assert.ok(proc>=0&&dom>=0&&proc<priv&&dom<priv,label+': SystemHelper must precede private');
  const p1=idx(rules,'DST-PORT,18080,REJECT'),p2=idx(rules,'DST-PORT,18081,REJECT');
  assert.ok(priv<p1&&p1<p2,label+': private must precede global port blocks');
  const ex=idx(rules,'RULE-SET,defense-exceptions,直连'),av=idx(rules,'RULE-SET,avenue-ads,AdBlock'),cn=idx(rules,'RULE-SET,geolocation-cn,直连');
  assert.ok(ex>p2&&av>ex&&cn>av,label+': generic defense order is wrong');
}
for(const [label,file] of TARGETS){
  const defaults=output(file),api=defaults.api,cfg=defaults.config,opts=api.ruleOptionsEnable;
  assertOrder(label,cfg.rules);
  const p=cfg['rule-providers'];
  for(const name of ['avenue-ads','defense-exceptions','adrules','banprogramad'])assert.ok(p[name],label+': missing '+name);
  assert.equal(Boolean(p['native-vivo']),opts.屏蔽Vivo原生遥测===true);
  assert.equal(Boolean(p['native-vivo-extra']),opts.屏蔽Vivo历史补充名单===true);
  assert.equal(Boolean(p['native-huawei']),opts.屏蔽Huawei原生遥测===true);

  const noApp=output(file,{屏蔽SystemHelper遥测:false}).config;
  assert.ok(!noApp.rules.includes('PROCESS-NAME,com.mobiletools.systemhelper,REJECT'));
  assert.ok(!noApp.rules.includes('DOMAIN,dm.wo.com.cn,REJECT'));

  const noPorts=output(file,{屏蔽SystemHelper遥测端口:false}).config;
  assert.ok(!noPorts.rules.includes('DST-PORT,18080,REJECT')&&!noPorts.rules.includes('DST-PORT,18081,REJECT'));
  assert.ok(noPorts.rules.indexOf('RULE-SET,defense-exceptions,直连')>noPorts.rules.indexOf('RULE-SET,private,直连'));

  const lite=output(file,{完整防线:false}).config;
  assert.ok(!lite['rule-providers'].adrules&&!lite.rules.includes('RULE-SET,adrules,AdBlock'));

  const noBan=output(file,{屏蔽BanProgramAD:false}).config;
  assert.ok(!noBan['rule-providers'].banprogramad&&!noBan.rules.includes('RULE-SET,banprogramad,AdBlock'));

  const noAd=output(file,{AdBlock:false}).config;
  for(const name of ['avenue-ads','defense-exceptions','adrules','banprogramad'])assert.ok(!noAd['rule-providers'][name]);
  assert.ok(noAd.rules.includes('PROCESS-NAME,com.mobiletools.systemhelper,REJECT'));

  const vivoOn=output(file,{屏蔽Vivo原生遥测:true}).config;
  assert.ok(vivoOn['rule-providers']['native-vivo']&&vivoOn.rules.includes('RULE-SET,native-vivo,AdBlock'));
  const vivoExtraOn=output(file,{屏蔽Vivo历史补充名单:true}).config;
  assert.ok(vivoExtraOn['rule-providers']['native-vivo-extra']&&vivoExtraOn.rules.includes('RULE-SET,native-vivo-extra,AdBlock'));
  const huaweiOn=output(file,{屏蔽Huawei原生遥测:true}).config;
  assert.ok(huaweiOn['rule-providers']['native-huawei']&&huaweiOn.rules.includes('RULE-SET,native-huawei,AdBlock'));

  const noSpot=output(file,{启用定点防线:false}).config;
  assert.ok(!noSpot.rules.includes('DOMAIN-SUFFIX,pangle.cn,AdBlock'));
  console.log('✓ '+label+': order, switches, providers and exception boundary');
}
console.log('All defense tests passed.');
