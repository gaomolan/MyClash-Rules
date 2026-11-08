'use strict';

const targets = [
  { file: 'Script/mihomoScriptGo.js', label: 'Go 主脚本', combo: false },
  { file: 'Script/mihomoScriptGo-combo.js', label: 'Combo 生成版', combo: true },
];

function withOptions(api, patch, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(patch)) {
    saved[key] = api.ruleOptionsEnable[key];
    api.ruleOptionsEnable[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(patch)) api.ruleOptionsEnable[key] = saved[key];
  }
}

function loadWithOption(loadScript, file, key, value) {
  return loadScript(file, (source) => {
    // 开关名称均为仓库内固定中文/字母标识符，无正则元字符。
    const pattern = new RegExp('(^[ \\t]*' + key + ':[ \\t]*)(true|false)(,)', 'gm');
    const matches = source.match(pattern) || [];
    if (matches.length !== 1) throw new Error(`配置开关锚点不唯一或不存在：${key}`);
    return source.replace(pattern, '$1' + value + '$3');
  });
}

function indexOfRule(rules, prefix) {
  return rules.findIndex((rule) => rule.startsWith(prefix));
}

function runPrivacyDefenseTests({ harness: h, loadScript, fixtures }) {
  h.section('隐私防护回归 · 应用拦截与规则优先级');

  for (const target of targets) {
    h.test(`${target.label}：SystemHelper 进程与域名拦截先于 private 直连`, () => {
      const api = loadScript(target.file);
      const out = api.main(fixtures.typicalSubscription());
      const rules = out.rules;
      const process = indexOfRule(rules, 'PROCESS-NAME,com.mobiletools.systemhelper,REJECT');
      const domain = indexOfRule(rules, 'DOMAIN,dm.wo.com.cn,REJECT');
      const privateRule = indexOfRule(rules, 'RULE-SET,private,直连');
      const domestic = indexOfRule(rules, 'RULE-SET,geolocation-cn,直连');
      h.assert(process >= 0, '缺少 SystemHelper 包名规则');
      h.assert(domain >= 0, '缺少 SystemHelper 域名兜底');
      h.assert(privateRule >= 0, '缺少 private 规则');
      h.assert(process < domain && domain < privateRule, '应用与域名封锁必须先于 private 直连');
      h.assert(privateRule < domestic, 'private 例外必须先于国内直连');
      h.assert(process < domestic, 'SystemHelper 不得被国内直连提前放行');
    });

    h.test(`${target.label}：SystemHelper 开关关闭时移除进程和域名规则`, () => {
      const api = loadWithOption(loadScript, target.file, '屏蔽SystemHelper遥测', false);
      const out = api.main(fixtures.typicalSubscription());
      h.assert(indexOfRule(out.rules, 'PROCESS-NAME,com.mobiletools.systemhelper,REJECT') < 0);
      h.assert(indexOfRule(out.rules, 'DOMAIN,dm.wo.com.cn,REJECT') < 0);
    });

    h.test(`${target.label}：端口拦截开关独立生效`, () => {
      const api = loadScript(target.file);
      const enabled = api.main(fixtures.typicalSubscription()).rules;
      h.assert(indexOfRule(enabled, 'DST-PORT,18080,REJECT') >= 0, '缺少 18080 拦截');
      h.assert(indexOfRule(enabled, 'DST-PORT,18081,REJECT') >= 0, '缺少 18081 拦截');
      const disabledApi = loadWithOption(loadScript, target.file, '屏蔽SystemHelper遥测端口', false);
      const disabled = disabledApi.main(fixtures.typicalSubscription()).rules;
      h.assert(indexOfRule(disabled, 'DST-PORT,18080,REJECT') < 0);
      h.assert(indexOfRule(disabled, 'DST-PORT,18081,REJECT') < 0);
      h.assert(indexOfRule(disabled, 'PROCESS-NAME,com.mobiletools.systemhelper,REJECT') >= 0,
        '关闭全局端口规则不应关闭应用级拦截');
    });

    h.test(`${target.label}：厂商 Native Tracker 开关同步控制规则与 provider`, () => {
      const vendors = [
        ['Vivo', '拦截Vivo原生追踪', 'native-vivo'],
        ['Huawei', '拦截Huawei原生追踪', 'native-huawei'],
        ['Xiaomi', '拦截Xiaomi原生追踪', 'native-xiaomi'],
        ['OPPO/Realme', '拦截OppoRealme原生追踪', 'native-oppo-realme'],
        ['Samsung', '拦截Samsung原生追踪', 'native-samsung'],
        ['Apple', '拦截Apple原生追踪', 'native-apple'],
        ['Microsoft', '拦截Microsoft原生追踪', 'native-winoffice'],
        ['Amazon', '拦截Amazon原生追踪', 'native-amazon'],
        ['TikTok', '拦截TikTok原生追踪', 'native-tiktok'],
        ['LG webOS', '拦截LGwebOS原生追踪', 'native-lgwebos'],
        ['Roku', '拦截Roku原生追踪', 'native-roku'],
      ];
      for (const [vendor, option, provider] of vendors) {
        const enabledApi = loadWithOption(loadScript, target.file, option, true);
        const enabled = enabledApi.main(fixtures.typicalSubscription());
        h.assert(indexOfRule(enabled.rules, `RULE-SET,${provider},AdBlock`) >= 0,
          `${vendor} 开关开启后缺少规则`);
        h.assert(Object.prototype.hasOwnProperty.call(enabled['rule-providers'], provider),
          `${vendor} 开关开启后缺少 provider`);

        const disabledApi = loadWithOption(loadScript, target.file, option, false);
        const disabled = disabledApi.main(fixtures.typicalSubscription());
        h.assert(indexOfRule(disabled.rules, `RULE-SET,${provider},AdBlock`) < 0,
          `${vendor} 开关关闭后仍有规则`);
        h.assert(!Object.prototype.hasOwnProperty.call(disabled['rule-providers'], provider),
          `${vendor} 开关关闭后仍注册 provider`);
      }
    });

    if (target.combo) {
      h.test('Combo：完整防线顺序正确，且例外名单不能绕过 SystemHelper 应用封锁', () => {
        const api = loadScript(target.file);
        const rules = api.main(fixtures.typicalSubscription()).rules;
        const at = (p) => indexOfRule(rules, p);
        const process = at('PROCESS-NAME,com.mobiletools.systemhelper,REJECT');
        const domain = at('DOMAIN,dm.wo.com.cn,REJECT');
        const privateRule = at('RULE-SET,private,直连');
        const exception = at('RULE-SET,defense-exceptions,直连');
        const avenue = at('RULE-SET,avenue-ads,AdBlock');
        const adrules = at('RULE-SET,adrules,AdBlock');
        const vivo = at('RULE-SET,native-vivo,AdBlock');
        const huawei = at('RULE-SET,native-huawei,AdBlock');
        const ban = at('RULE-SET,banprogramad,AdBlock');
        const domestic = at('RULE-SET,geolocation-cn,直连');
        h.assert(process < domain && domain < privateRule, '应用级规则顺序错误');
        h.assert(privateRule < exception, '例外名单应保留 private 之后');
        h.assert(exception < avenue && avenue < adrules && adrules < ban &&
          ban < vivo && vivo < huawei && huawei < domestic, '主防线组件顺序错误');
        for (const name of ['native-vivo', 'native-huawei', 'adrules', 'banprogramad', 'defense-exceptions']) {
          h.assert(Object.prototype.hasOwnProperty.call(api.main(fixtures.typicalSubscription())['rule-providers'], name),
            `缺少规则集 provider：${name}`);
        }
      });

      h.test('Combo：轻量模式只移除 AdRules，不移除其他防线', () => {
        const api = loadScript(target.file);
        withOptions(api, { 完整防线: false }, () => {
          const out = api.main(fixtures.typicalSubscription());
          h.assert(indexOfRule(out.rules, 'RULE-SET,adrules,AdBlock') < 0);
          for (const prefix of [
            'RULE-SET,avenue-ads,AdBlock',
            'RULE-SET,native-vivo,AdBlock',
            'RULE-SET,native-huawei,AdBlock',
            'RULE-SET,banprogramad,AdBlock',
          ]) h.assert(indexOfRule(out.rules, prefix) >= 0, `轻量模式不应移除 ${prefix}`);
          h.assert(!Object.prototype.hasOwnProperty.call(out['rule-providers'], 'adrules'));
        });
      });
    }
  }
}

module.exports = { runPrivacyDefenseTests };
