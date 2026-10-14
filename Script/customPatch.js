// ============================================================
// MyClash 用户追加功能
// 功能：为指定地区增加「地区-低倍率自动选择」
// ============================================================
//
// 设计说明：
// 1. 本代码不修改 MyClash 原有函数。
// 2. 不重复定义地区正则。
// 3. 不重复定义低倍率正则。
// 4. 直接复用 MyClash 原脚本已有的：
//      - rateRegionDefinitions
//      - lowRateRegionName
//      - urlTestBaseOption
//      - iconBaseUrl
// 5. 通过包装原 main() 的方式，在原配置生成完成后追加策略组。
// 6. 因此这是“只增加代码”，不需要修改上游原有代码。
// ============================================================

const CUSTOM_LOW_RATE_AUTO_SELECT_ENABLED = true;

const CUSTOM_LOW_RATE_REGIONS = new Set([
  '香港',
  '日本',
  '美国',
  '新加坡',
  '台湾省',
]);

const CUSTOM_ORIGINAL_MAIN = main;

main = function customMain(config) {
  const result = CUSTOM_ORIGINAL_MAIN(config);

  if (!CUSTOM_LOW_RATE_AUTO_SELECT_ENABLED) {
    return result;
  }

  if (
    !Array.isArray(result['proxy-groups']) ||
    !Array.isArray(result.proxies)
  ) {
    return result;
  }

  const lowRateDefinition = rateRegionDefinitions.find(
    (item) => item.name === lowRateRegionName,
  );

  if (!lowRateDefinition || !lowRateDefinition.regex) {
    return result;
  }

  const lowRateRegex = lowRateDefinition.regex;

  for (const regionName of CUSTOM_LOW_RATE_REGIONS) {
    const regionGroup = result['proxy-groups'].find(
      (group) =>
        group &&
        group.name === regionName &&
        group.type === 'select',
    );

    if (!regionGroup || !Array.isArray(regionGroup.proxies)) {
      continue;
    }

    const lowRateProxies = regionGroup.proxies.filter(
      (proxyName) =>
        typeof proxyName === 'string' &&
        result.proxies.some(
          (proxy) =>
            proxy &&
            proxy.name === proxyName,
        ) &&
        lowRateRegex.test(proxyName),
    );

    if (lowRateProxies.length === 0) {
      continue;
    }

    const lowRateGroupName =
      `${regionName}-低倍率自动选择`;

    const alreadyExists = result['proxy-groups'].some(
      (group) =>
        group &&
        group.name === lowRateGroupName,
    );

    if (alreadyExists) {
      continue;
    }

    result['proxy-groups'].push({
      ...urlTestBaseOption,
      name: lowRateGroupName,
      proxies: lowRateProxies,
      icon: `${iconBaseUrl}Available.svg`,
      hidden: true,
    });

    regionGroup.proxies.push(lowRateGroupName);
  }

  return result;
};
