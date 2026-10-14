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

// ============================================================
// MyClash 用户自定义 DNS 覆盖
// 目标：移除阿里 DNS，国内及节点域名解析使用腾讯 DNS，国外域名使用 Cloudflare DoH
// ============================================================

const CUSTOM_DNS_ORIGINAL_MAIN = main;

main = function customDnsMain(config) {
  const result = CUSTOM_DNS_ORIGINAL_MAIN(config);

  if (!result || typeof result !== 'object') {
    return result;
  }

  const dns = result.dns && typeof result.dns === 'object'
    ? result.dns
    : {};

  const tencentDNS = ['119.29.29.29', '1.12.12.12'];

  // 基础 DNS：仅使用腾讯 DNS IP，不再请求阿里 DNS 的 TCP 853 端口
  dns['default-nameserver'] = [...tencentDNS];

  // 代理节点域名：使用腾讯 DoH，并通过 DIRECT 连接
  // 上游脚本的 hosts 中已为 doh.pub 配置 IP，避免 DoH 引导解析循环
  dns['proxy-server-nameserver'] = [
    'https://doh.pub/dns-query#DIRECT',
  ];

  // 普通国外域名：使用 Cloudflare DoH，经默认代理访问
  dns.nameserver = [
    'https://cloudflare-dns.com/dns-query#默认代理',
  ];

  // 国内域名：统一使用腾讯 DNS
  dns['nameserver-policy'] = {
    'rule-set:private': 'system',
    'rule-set:douyin': [...tencentDNS],
    'rule-set:cn': [...tencentDNS],
  };

  dns['direct-nameserver'] = [...tencentDNS];
  dns['direct-nameserver-follow-policy'] = true;

  // 不输出旧版字段，避免 fallback-filter.geosite 兼容性警告
  delete dns['fallback-filter'];

  result.dns = dns;
  return result;
};

