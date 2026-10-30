// ============================================================
// Clash-rules-go · 专属全局 Mihomo 覆写脚本 v1.0.0-phase3【组合脚本 · 仅自用，不对外发布】
// 脚本地址：https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/Script/mihomoScriptGo-combo.js
// 直连地址：https://raw.githubusercontent.com/gaomolan/MyClash-Rules/myclash-rules/Script/mihomoScriptGo-combo.js
// 本文件由 mihomoScriptGo.js 派生：通用逻辑与 Go 主版保持同步，个人定制只存在于
// 标记为 [组合脚本专属] 的代码段（Spark 港/新专属分组 + 其余 Spark 节点剔除 + 全局可见性隔离）。
// 更新规矩：底板永远是 Go 主版；Go 更新时把 [组合脚本专属] 段整体迁移到新底板，不在本文件上单独演进通用逻辑。
// 2026-10-30 [组合脚本专属] 新增主防线（完整/轻量双档）：防线段前置 + AdRules/Native/BanProgramAD/例外名单/定点段；
//   Go 主版与 smart 版未同步，combo 先行试运行一周后再定是否回灌底板。
// Forked from AIsouler/MyClash (https://github.com/AIsouler/MyClash)
// ------------------------------------------------------------
// 总原则：软件能管的让软件管，软件管不了的才让脚本管。
//   · 连接面（端口/TUN/日志级别等）归 App：脚本只做"读现有值、缺失才补默认"兜底，
//     不与客户端设置冲突（Clash Verge Rev v2.5.5+ 会告警并丢弃脚本对接管字段的写入）。
//   · 分流/DNS 面归脚本：DNS、hosts、代理组、规则、规则集全权负责。
// 适用：Bettbox / Clash Verge Rev / 软路由裸 Mihomo / 任何支持 Mihomo Script 覆写的客户端
// ⚠️  高影响配置处均有 ⚠️ 注释说明风险与建议值，改动前请先阅读。
// ============================================================

// ===== [组合脚本专属] Spark 组合池配置 =====
// 识别合并订阅里带 [Spark] 前缀的节点：
//   · 中国香港 / 新加坡的 Spark 节点 → 只进 Spark 专属组（见 buildComboSparkGroups）；
//   · 其他地区的 Spark 节点 → 直接从最终配置中剔除；
//   · 非 Spark 节点（含无前缀的普通订阅）→ 行为与 Go 主版完全一致。
const COMBO_SPARK_TAG = '[Spark]';
const COMBO_SPARK_KEEP_REGIONS = ['中国香港', '新加坡'];

// --- 静态配置区域 ---

// 适配 Bettbox 自定义配置参数
const Compatible_With_Bettbox = { ruleOptionsEnable: true };

/**
 * 自定义配置选项
 * true = 启用
 * false = 禁用
 */
const ruleOptionsEnable = {
  // 基础策略组
  手动选择: true, // 是否启用手动选择策略组
  Auto: true, // 是否启用 Auto 自动选择策略组（与实际策略组名称一致）
  负载均衡: true, // 是否启用负载均衡策略组

  // 以下为分流策略配置
  FCM: true, // GoogleFCM服务
  YouTube: true, // YouTube视频平台
  Google: true, // Google服务
  AI: true, // 国外AI服务（Claude 除外，见 Claude 组）
  GitHub: true, // GitHub代码托管平台
  Claude: true, // Claude（Anthropic）独立分组，其余 AI 服务归 AI 组
  Microsoft: true, // Microsoft服务
  Apple: true, // Apple服务
  Telegram: true, // Telegram通讯软件
  TikTok: true, // TikTok视频平台
  Twitter: true, // Twitter社交平台
  Meta: true, // Meta服务
  Emby: true, // Emby媒体服务
  PikPak: true, // PikPak网盘服务
  Financial: true, // 金融统一组（加密货币+传统金融）
  AdBlock: true, // 广告拦截
  Cloudflare: true, // Cloudflare 策略组（Phase 2 新增）
  显示低倍率节点: true, // 是否显示低倍率策略组（关闭则隐藏，组依然可用）
  显示高倍率节点: true, // 是否显示高倍率策略组（关闭则隐藏，组依然可用）

  // 以下为非分流策略配置
  生成地区自动选择组: true, // 是否生成地区自动选择策略组
  隐藏地区手动选择组: false, // 是否隐藏地区手动选择策略组
  生成倍率组: true, // 是否生成低倍率/高倍率策略组
  分流组添加所有节点: false, // 是否为分流策略组添加所有节点
  过滤低倍率节点: false, // 是否过滤低倍率节点（旧开关，保留兼容）
  过滤高倍率节点: false, // 是否过滤高倍率节点（旧开关，保留兼容）
  过滤非地区节点: true, // 是否过滤非地区节点
  屏蔽国外QUIC: true, // 是否屏蔽国外QUIC流量
  代理IPV4优先: true, // 是否将订阅节点统一为 IPv4 优先（与“代理IPV6优先”同时开启时不生效）
  代理IPV6优先: false, // 是否将订阅节点统一为 IPv6 优先（与“代理IPV4优先”同时开启时不生效）

  // ---- Phase 1 新增开关 ----
  // ⚠️ IPv6总开关：仅控制 DNS 解析是否允许 IPv6（dns.ipv6），不管顶层 ipv6。
  //    默认关闭可防 DNS 泄露（移动网 IPv6 直连暴露真实出口）。
  //    【已知缺口】顶层 ipv6 留空交 App 接管——若 App 里 ipv6:true，本开关关不掉它，
  //    此时"IPv6总开关: false" ≠ 全关 IPv6。想彻底关，请同时在 App 设置里关掉 IPv6。
  IPv6总开关: false,
  // Sniffer 配置开关：开启后由脚本写入完整 Sniffer 配置（含金融 skip-domain 跳过名单）。
  //    默认关闭；Bettbox 开启"覆写 Sniffer"时 App 配置整体替换脚本写入，无影响；分享给他人时作兜底。
  启用Sniffer配置: false,

  // ---- Phase 2 新增开关：WebRTC 双开关 ----
  // 开关1「WebRTC走代理」（默认开）：STUN 流量走代理而非直连，泄露的也是难追踪的代理 IP。
  //   实现三件套：①顶层 ipv6 仅在未设置时按开关设为 false；②dns.ipv6 与「IPv6总开关」做与逻辑；
  //   ③仅为缺省 udp 字段的普通代理节点补 udp:true（显式声明的保持原样）。
  // 开关2「屏蔽STUN端口」（默认关）：直接拦截常见 STUN/TURN 端口，优先级高于开关1。
  //   ⚠️ 非全覆盖：非常用端口的 STUN 仍可能漏网；日常建议只开开关1，严格场景再开开关2。
  WebRTC走代理: true,
  屏蔽STUN端口: false,

  // ---- 主防线开关（2026-10-30 新增，仅组合脚本先行试运行）----
  // 防线段位于规则链最前（private 之后、geolocation-cn 之前），组成与命中实测见仓库外存档 PLAN-B。
  // true=完整防线：例外名单 + AWAvenue + AdRules + 厂商遥测（vivo/华为）+ BanProgramAD + 定点段，约 20.7 万域名；
  // false=轻量防线：仅去掉 AdRules，其余不变（约 2.3k 域名），低配设备或排查问题时用。
  // 整体回滚：与本开关无关，把 AdBlock 组切到 PASS 即全部放行；关停 AdBlock 组则整段跳过。
  完整防线: true,
};

// ---- 策略组默认选中集中配置 ----
// 各服务组定义处不再散落写 defaultSelected，统一在此维护。
// 遵循 MyClash 原版默认值（不按个人习惯），分享给他人时默认值保持通用。
const defaultSelectedMap = {
  FCM: '直连',
  AI: '美国',
  Claude: '美国',
  TikTok: '日本',
  Financial: '日本', // 继承原 Crypto 默认（统一金融组）
};

// ---- Sniffer 金融跳过名单 ----
// 域名嗅探（sniffing）会改写部分 App 的流量目标，银行/券商/行情类 App 对此敏感，
// 可能导致断连或风控。以下域名在启用 Sniffer 配置时会被跳过嗅探。
// 来源：金融组域名素材（IBKR/MT5/TradingView/券商），使用中逐步补充。
const snifferFinanceSkipDomains = [
  // Mihomo/App 通用跳过（与 Bettbox 默认一致）
  'Mijia Cloud',
  '+.push.apple.com',
  // IBKR 盈透证券
  '+.ibllc.com',
  '+.ibllc.com.cn',
  '+.ibkr.com',
  '+.interactivebrokers.com',
  // MT5 / MetaQuotes
  '+.metaquotes.net',
  '+.metatrader5.com',
  '+.metatrader4.com',
  '+.mql5.com',
  // TradingView
  '+.tradingview.com',
  // 券商
  '+.firstrade.com',
  '+.mitrade.com',
  '+.itiger.com',
  '+.tigerfintech.com',
  '+.tradeup.com',
];

// 定义前置规则
const prefixRules = [
  // 规则集下载域名直连，避免规则集尚未加载时出现循环依赖
  'DOMAIN,cdn.jsdmirror.com,直连',
  'DOMAIN,raw.githubusercontent.com,直连',

  // 私有网络直连
  'RULE-SET,private,直连',

  // 国内直连
  'RULE-SET,geolocation-cn,直连',
  'RULE-SET,games_cn,直连', // 已包含 steam 下载域名
  'RULE-SET,nvidia_cn,直连',
  'RULE-SET,apple_cn,直连',
  'RULE-SET,microsoft_cn,直连',
  'DOMAIN,fsend.cn,直连',
  'DOMAIN,international-gfe.download.nvidia.com,直连',
  'DOMAIN-SUFFIX,ctaiot.com,直连', // 中国电信物联网（借鉴上游 2026-10-21 补充）
];

// 此处添加自定义节点，填入下方[]内（可选，留空则不生成“自建节点”策略组）
// 自定义节点不参与节点过滤与 hosts 改写；与订阅节点（标准化后）重名时自动添加“自建-”前缀
// 示例：
// const customizeProxies = [
//   {
//     name: '自建-日本-01',
//     type: 'vmess',
//     server: '5.6.7.8',
//     port: 443,
//     uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
//     alterId: 0,
//     cipher: 'auto',
//     tls: true,
//     servername: 'example.com',
//     network: 'ws',
//     'ws-opts': {
//       path: '/path',
//       headers: { Host: 'example.com' },
//     },
//   },
// ];
const customizeProxies = [];

// 定义全局排除节点的正则表达式，用于排除非地区节点
const excludeFilter =
  /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|电报|无法|说明|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|优惠|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|过滤|⚠️|@|t\.me\/\+|\bexpire\b|\bhttps?:\/\/|\.com|\btraffic\b/iu;

// 屏蔽国外QUIC
const blockForeignQuic = [
  'AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT',
];

// ---- 常见 STUN/TURN 端口拦截（WebRTC 双开关之开关2「屏蔽STUN端口」） ----
// 只匹配列出的端口，不拦截全部 UDP。UDP 19302-19309 是常见 WebRTC 实现使用范围，不代表所有 STUN/TURN 流量。
// TURN over TCP 443 不在此拦截，避免影响普通 HTTPS。
// 私有 IP 的同端口例外规则必须排在拒绝规则前，避免误伤内网服务（如内网语音/视频会议）。
// ⚠️ 开关2优先于开关1；日常建议只开开关1（STUN 走代理），严格场景（如防追踪审计）再开开关2。
const privateStunDirectRules = [
  'AND,((NETWORK,UDP),(DST-PORT,3478),(RULE-SET,private_ip,no-resolve)),直连',
  'AND,((NETWORK,TCP),(DST-PORT,3478),(RULE-SET,private_ip,no-resolve)),直连',
  'AND,((NETWORK,UDP),(DST-PORT,5349),(RULE-SET,private_ip,no-resolve)),直连',
  'AND,((NETWORK,TCP),(DST-PORT,5349),(RULE-SET,private_ip,no-resolve)),直连',
  'AND,((NETWORK,UDP),(DST-PORT,19302-19309),(RULE-SET,private_ip,no-resolve)),直连',
];

const blockStunPorts = [
  'AND,((NETWORK,UDP),(DST-PORT,3478)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,3478)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,5349)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,5349)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,19302-19309)),REJECT',
];

// 直连节点
const directProxies = [
  {
    name: '🇨🇳 直连 | 双栈',
    type: 'direct',
  },
  {
    name: '🇨🇳 直连 | IPv4优先',
    type: 'direct',
    'ip-version': 'ipv4-prefer',
  },
  {
    name: '🇨🇳 直连 | IPv6优先',
    type: 'direct',
    'ip-version': 'ipv6-prefer',
  },
  {
    name: '🇨🇳 直连 | 仅IPv4',
    type: 'direct',
    'ip-version': 'ipv4',
  },
  {
    name: '🇨🇳 直连 | 仅IPv6',
    type: 'direct',
    'ip-version': 'ipv6',
  },
];

// 图标 URL 公共前缀
const iconBaseUrl = 'https://cdn.jsdmirror.com/gh/AIsouler/MyClash@main/Icons/svg/';

// 规则集 URL 公共前缀
const ruleSetBaseUrl = 'https://raw.githubusercontent.com/appshubcc/bett-rules/meta/geo/';
// ASN 规则集基础地址（bett-rules asn/ 目录，按 ASN 切分的 IP 段，供 Financial 组 ASN 兜底用）
const asnBaseUrl = ruleSetBaseUrl.replace(/\/geo\/$/, '/asn/');

// 定义地区策略组
const regionDefinitions = [
  {
    name: '中国香港',
    flag: '🇭🇰',
    regex: /🇭🇰|中国香港|香港|(?<![A-Za-z])HKG?(?![A-Za-z])|hong\s*kong/i,
    icon: `${iconBaseUrl}HongKong.svg`,
  },
  {
    name: '日本',
    flag: '🇯🇵',
    regex: /🇯🇵|日本|东京|大阪|京都|(?<![A-Za-z])JPN?(?![A-Za-z])|japan/i,
    icon: `${iconBaseUrl}Japan.svg`,
  },
  {
    name: '美国',
    flag: '🇺🇸',
    regex:
      /🇺🇸|美国|纽约|洛杉矶|旧金山|芝加哥|休斯顿|迈阿密|西雅图|波士顿|华盛顿|拉斯维加斯|圣何塞|(?<![A-Za-z])USA?(?![A-Za-z])|america|united\s*states/i,
    icon: `${iconBaseUrl}America.svg`,
  },
  {
    name: '新加坡',
    flag: '🇸🇬',
    regex: /🇸🇬|新加坡|狮城|(?<![A-Za-z])SGP?(?![A-Za-z])|singapore/i,
    icon: `${iconBaseUrl}Singapore.svg`,
  },
  {
    name: '中国台湾',
    flag: '🇹🇼',
    regex: /🇹🇼|中国台湾|台湾|台北|高雄|新北|桃园|新竹|(?<![A-Za-z])TWN?(?![A-Za-z])|taipei|hinet|taiwan/i,
    icon: `${iconBaseUrl}Taiwan.svg`,
  },
];

// 定义倍率策略组
const lowRateRegionName = '低倍率节点';
const highRateRegionName = '高倍率节点';

const rateRegionDefinitions = [
  {
    name: lowRateRegionName,
    regex:
      /^(?!.*(?:剩|期)).*(?:(?<![\d.])0(\.[0-5]|[*×✕✖⨯⨉x倍]))|(?:[*×✕✖⨯⨉x]0)|^(?!.*(?:客户端|软件)).*下载|低倍|免费|(?<![A-Za-z])free(?![A-Za-z])/i,
    icon: `${iconBaseUrl}Available.svg`,
  },
  {
    name: highRateRegionName,
    regex:
      /(?:[*×✕✖⨯⨉x](?:1\.(?:[1-9]\d*)|[2-9](?:\.\d+)?|[1-9]\d+(?:\.\d+)?))|(?:(?<![\d.])(?:1\.(?:[1-9]\d*)|[2-9](?:\.\d+)?|[1-9]\d+(?:\.\d+)?)(?:倍|[*×✕✖⨯⨉x]))/i,
    icon: `${iconBaseUrl}Airport.svg`,
  },
];

// 全部策略组定义（地区 + 倍率），统一用于节点匹配与归类
const allRegionDefinitions = [...regionDefinitions, ...rateRegionDefinitions];

// Rule Providers 通用配置
const ruleProviderCommonDomain = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'domain',
};
const ruleProviderCommonIpcidr = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'ipcidr',
};

// 定义基础 Rule Providers
const baseRuleProviders = {
  // --- 直连规则集 ---

  private: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/private.mrs`,
    path: './ruleset/private.mrs',
    'path-in-bundle': 'geo/geosite/private.mrs',
  },
  private_ip: {
    ...ruleProviderCommonIpcidr,
    url: `${ruleSetBaseUrl}geoip/private.mrs`,
    path: './ruleset/private_ip.mrs',
    'path-in-bundle': 'geo/geoip/private.mrs',
  },
  games_cn: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/category-games@cn.mrs`,
    path: './ruleset/category-games@cn.mrs',
    'path-in-bundle': 'geo/geosite/category-games@cn.mrs',
  },
  nvidia_cn: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/nvidia@cn.mrs`,
    path: './ruleset/nvidia@cn.mrs',
    'path-in-bundle': 'geo/geosite/nvidia@cn.mrs',
  },
  apple_cn: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/apple@cn.mrs`,
    path: './ruleset/apple@cn.mrs',
    'path-in-bundle': 'geo/geosite/apple@cn.mrs',
  },
  microsoft_cn: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/microsoft@cn.mrs`,
    path: './ruleset/microsoft@cn.mrs',
    'path-in-bundle': 'geo/geosite/microsoft@cn.mrs',
  },
  'geolocation-cn': {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/geolocation-cn.mrs`,
    path: './ruleset/geolocation-cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-cn.mrs',
  },
  cn_ip: {
    ...ruleProviderCommonIpcidr,
    url: `${ruleSetBaseUrl}geoip/cn.mrs`,
    path: './ruleset/cn_ip.mrs',
    'path-in-bundle': 'geo/geoip/cn.mrs',
  },

  // --- 代理规则集 ---

  'geolocation-!cn': {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/geolocation-!cn.mrs`,
    path: './ruleset/geolocation-!cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-!cn.mrs',
  },

  // 国内域名直连：小红书、B站等国内 App 必须直连，走代理会被拒。
  'cn': {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/cn.mrs`,
    path: './ruleset/cn.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },

  // --- 其他规则集 ---

  fakeip_filter: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/fakeip-filter.mrs`,
    path: './ruleset/fakeip-filter.mrs',
    'path-in-bundle': 'geo/geosite/fakeip-filter.mrs',
  },
  cn_additional: {
    ...ruleProviderCommonDomain,
    url: 'https://static-file-global.353355.xyz/rules/cn-additional-list.mrs',
    path: './ruleset/cn-additional-list.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
  cn: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/cn.mrs`,
    path: './ruleset/cn.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
  douyin: {
    ...ruleProviderCommonDomain,
    url: `${ruleSetBaseUrl}geosite/douyin.mrs`,
    path: './ruleset/douyin.mrs',
    'path-in-bundle': 'geo/geosite/douyin.mrs',
  },
};

// 策略组公共配置
const groupBaseOption = {
  interval: 600,
  timeout: 3000,
  url: 'https://www.apple.com/library/test/success.html',
  lazy: true,
  'max-failed-times': 3,
  'empty-fallback': 'REJECT',
};

// select策略组通用配置
const selectBaseOption = {
  ...groupBaseOption,
  type: 'select',
};

// url-test策略组通用配置
const urlTestBaseOption = {
  ...groupBaseOption,
  type: 'url-test',
  tolerance: 50,
  'exclude-type': 'DIRECT',
  icon: `${iconBaseUrl}Auto.svg`,
  hidden: true,
};

// load-balance策略组通用配置
const loadBalanceBaseOption = {
  ...groupBaseOption,
  type: 'load-balance',
  strategy: 'sticky-sessions',
  'exclude-type': 'DIRECT',
  icon: `${iconBaseUrl}RoundRobin.svg`,
  hidden: true,
};

// 定义基础策略组
const baseGroups = [
  {
    name: '手动选择',
    baseOption: selectBaseOption,
    includeAll: true,
    icon: `${iconBaseUrl}Static.svg`,
  },
  {
    name: 'Auto',
    baseOption: urlTestBaseOption,
    includeAll: true,
    icon: `${iconBaseUrl}Auto.svg`,
  },
  {
    name: '负载均衡',
    baseOption: loadBalanceBaseOption,
    includeAll: true,
    icon: `${iconBaseUrl}RoundRobin.svg`,
  },
];

// 定义分流策略组配置
const serviceConfigs = [
  ...baseGroups,
  {
    name: 'FCM',
    baseOption: selectBaseOption,
    direct: true,
    defaultSelected: defaultSelectedMap.FCM,
    providers: {
      googlefcm: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/googlefcm.mrs`,
        path: './ruleset/googlefcm.mrs',
        'path-in-bundle': 'geo/geosite/googlefcm.mrs',
      },
    },
    icon: `${iconBaseUrl}Fcm.svg`,
    rules: ['RULE-SET,googlefcm,FCM'],
  },
  {
    name: 'YouTube',
    baseOption: selectBaseOption,
    providers: {
      youtube: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/youtube.mrs`,
        path: './ruleset/youtube.mrs',
        'path-in-bundle': 'geo/geosite/youtube.mrs',
      },
    },
    icon: `${iconBaseUrl}YouTube.svg`,
    rules: ['RULE-SET,youtube,YouTube'],
  },
  {
    name: 'Google',
    baseOption: selectBaseOption,
    providers: {
      google: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/google.mrs`,
        path: './ruleset/google.mrs',
        'path-in-bundle': 'geo/geosite/google.mrs',
      },
      google_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/google.mrs`,
        path: './ruleset/google_ip.mrs',
        'path-in-bundle': 'geo/geoip/google.mrs',
      },
    },
    icon: `${iconBaseUrl}Google.svg`,
    rules: ['RULE-SET,google,Google', 'RULE-SET,google_ip,Google,no-resolve'],
  },

  {
    // ---- Claude 组（Anthropic 独立分组） ----
    // 只收 Anthropic/Claude：手写核心域名 + anthropic 规则集（全量域名）+ ASN 399358 兜底。
    // 注：本组定义在 AI 组之前，规则优先命中——category-ai-!cn 规则集同样含 Anthropic 域名，
    // 靠顺序保证 Claude 流量不被 AI 组截走。其余 AI 服务（OpenAI/ChatGPT 等）统一归 AI 组。
    name: 'Claude',
    baseOption: selectBaseOption,
    defaultSelected: defaultSelectedMap.Claude,
    providers: {
      anthropic: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/anthropic.mrs`,
        path: './ruleset/anthropic.mrs',
        'path-in-bundle': 'geo/geosite/anthropic.mrs',
      },
    },
    // ASN 兜底：IP-ASN 原生规则（需 geox-url.asn 数据库）。Anthropic 官网挂 CDN，域名规则为主。
    icon: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/Icons/svg/Claude.svg',
    rules: [
      'DOMAIN-SUFFIX,anthropic.com,Claude',
      'DOMAIN-SUFFIX,claude.ai,Claude',
      'DOMAIN-SUFFIX,claude.com,Claude',
      'DOMAIN-SUFFIX,claudeusercontent.com,Claude',
      'RULE-SET,anthropic,Claude',
      'IP-ASN,399358,Claude,no-resolve',
    ],
  },
  {
    // ---- AI 组（Claude 以外的全部 AI 服务） ----
    // category-ai-!cn 规则集已覆盖：OpenAI/ChatGPT、Grok（x.ai/grok.com）、Gemini、Copilot、
    // Perplexity、Mistral、Meta AI / Muse（muse.ai）、Dola（dola.com）、Kimi 国际版（kimi.ai）等。
    // 下列手写规则只补规则集未收录的：Qwen 国际版、智谱国际版（z.ai）、英伟达 AI、OpenAI 登录用的 auth0。
    // 注意只收国际版域名：国内版（通义/豆包/智谱国内站等）继续走国内直连，不进本组。
    name: 'AI',
    baseOption: selectBaseOption,
    defaultSelected: defaultSelectedMap.AI,
    providers: {
      ai: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/category-ai-!cn.mrs`,
        path: './ruleset/ai.mrs',
        'path-in-bundle': 'geo/geosite/category-ai-!cn.mrs',
      },
    },
    icon: `${iconBaseUrl}OpenAI.svg`,
    rules: [
      // OpenAI 登录（Auth0 托管认证，规则集未收）
      'DOMAIN-SUFFIX,auth0.com,AI',
      // Qwen 国际版（chat.qwen.ai；API 走 dashscope 国际端点）
      'DOMAIN-SUFFIX,qwen.ai,AI',
      'DOMAIN,dashscope-intl.aliyuncs.com,AI',
      // 智谱国际版（chat.z.ai / api.z.ai）
      'DOMAIN-SUFFIX,z.ai,AI',
      // 英伟达 AI（模型广场 build / NIM 接口 nvcf / 模型目录 ngc；官网与驱动下载不进本组）
      'DOMAIN-SUFFIX,build.nvidia.com,AI',
      'DOMAIN-SUFFIX,nvcf.nvidia.com,AI',
      'DOMAIN-SUFFIX,ngc.nvidia.com,AI',
      'DOMAIN,integrate.api.nvidia.com,AI',
      'RULE-SET,ai,AI',
    ],
  },
  {
    name: 'GitHub',
    baseOption: selectBaseOption,
    providers: {
      github: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/github.mrs`,
        path: './ruleset/github.mrs',
        'path-in-bundle': 'geo/geosite/github.mrs',
      },
    },
    icon: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/Icons/svg/GitHub.svg',
    rules: ['RULE-SET,github,GitHub'],
  },
  {
    name: 'Microsoft',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      microsoft: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/microsoft.mrs`,
        path: './ruleset/microsoft.mrs',
        'path-in-bundle': 'geo/geosite/microsoft.mrs',
      },
      microsoft_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/microsoft.mrs`,
        path: './ruleset/microsoft_ip.mrs',
        'path-in-bundle': 'geo/geoip/microsoft.mrs',
      },
    },
    icon: `${iconBaseUrl}Microsoft.svg`,
    rules: ['RULE-SET,microsoft,Microsoft', 'RULE-SET,microsoft_ip,Microsoft,no-resolve'],
  },
  {
    name: 'Apple',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      apple: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/apple.mrs`,
        path: './ruleset/apple.mrs',
        'path-in-bundle': 'geo/geosite/apple.mrs',
      },
      apple_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/apple.mrs`,
        path: './ruleset/apple_ip.mrs',
        'path-in-bundle': 'geo/geoip/apple.mrs',
      },
    },
    icon: `${iconBaseUrl}Apple.svg`,
    rules: ['RULE-SET,apple,Apple', 'RULE-SET,apple_ip,Apple,no-resolve'],
  },
  {
    name: 'Telegram',
    baseOption: selectBaseOption,
    providers: {
      telegram: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/telegram.mrs`,
        path: './ruleset/telegram.mrs',
        'path-in-bundle': 'geo/geosite/telegram.mrs',
      },
      telegram_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/telegram.mrs`,
        path: './ruleset/telegram_ip.mrs',
        'path-in-bundle': 'geo/geoip/telegram.mrs',
      },
    },
    icon: `${iconBaseUrl}Telegram.svg`,
    rules: ['RULE-SET,telegram,Telegram', 'RULE-SET,telegram_ip,Telegram,no-resolve'],
  },
  
  {
    name: 'TikTok',
    baseOption: selectBaseOption,
    defaultSelected: defaultSelectedMap.TikTok,
    providers: {
      tiktok: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/tiktok.mrs`,
        path: './ruleset/tiktok.mrs',
        'path-in-bundle': 'geo/geosite/tiktok.mrs',
      },
      tiktok_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/tiktok.mrs`,
        path: './ruleset/tiktok_ip.mrs',
        'path-in-bundle': 'geo/geoip/tiktok.mrs',
      },
    },
    icon: `${iconBaseUrl}TikTok.svg`,
    rules: ['RULE-SET,tiktok,TikTok', 'RULE-SET,tiktok_ip,TikTok,no-resolve'],
  },
  {
    name: 'Twitter',
    baseOption: selectBaseOption,
    providers: {
      twitter: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/twitter.mrs`,
        path: './ruleset/twitter.mrs',
        'path-in-bundle': 'geo/geosite/twitter.mrs',
      },
      twitter_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/twitter.mrs`,
        path: './ruleset/twitter_ip.mrs',
        'path-in-bundle': 'geo/geoip/twitter.mrs',
      },
    },
    icon: `${iconBaseUrl}Twitter.svg`,
    rules: ['RULE-SET,twitter,Twitter', 'RULE-SET,twitter_ip,Twitter,no-resolve'],
  },
  {
    name: 'Meta',
    baseOption: selectBaseOption,
    providers: {
      meta: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/meta.mrs`,
        path: './ruleset/meta.mrs',
        'path-in-bundle': 'geo/geosite/meta.mrs',
      },
      facebook_ip: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/facebook.mrs`,
        path: './ruleset/facebook_ip.mrs',
        'path-in-bundle': 'geo/geoip/facebook.mrs',
      },
    },
    icon: `${iconBaseUrl}Meta.svg`,
    rules: ['RULE-SET,meta,Meta', 'RULE-SET,facebook_ip,Meta,no-resolve'],
  },
  
  
  {
    name: 'Emby',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      emby: {
        ...ruleProviderCommonDomain,
        url: 'https://cdn.jsdmirror.com/gh/666OS/rules@release/mihomo/domain/Emby.mrs',
        path: './ruleset/emby.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
      emos: {
        ...ruleProviderCommonDomain,
        url: 'https://cdn.jsdmirror.com/gh/binaryu/emos-proxy-rule@main/rules/emos-mihomo.mrs',
        path: './ruleset/emos.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
    },
    icon: `${iconBaseUrl}Emby.svg`,
    rules: [
      'RULE-SET,emby,Emby',
      'RULE-SET,emos,Emby',
      'DOMAIN-SUFFIX,mb3admin.com,Emby',
      'DOMAIN-SUFFIX,nubebelle.com,Emby',
      'DOMAIN-KEYWORD,emby,Emby',
      'PROCESS-NAME,com.mb.android,Emby',
      'PROCESS-NAME,tv.emby.embyatv,Emby',
      'PROCESS-NAME,com.hush.yamby,Emby',
      'PROCESS-NAME,com.jellycine.app,Emby',
      'PROCESS-NAME,com.mountains.hills,Emby',
      'PROCESS-NAME,RodelPlayer.App.exe,Emby',
      'PROCESS-NAME,com.feifeiduck.capyplayer,Emby',
    ],
  },
  {
    name: 'PikPak',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      pikpak: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/pikpak.mrs`,
        path: './ruleset/pikpak.mrs',
        'path-in-bundle': 'geo/geosite/pikpak.mrs',
      },
    },
    icon: `${iconBaseUrl}PikPak.svg`,
    rules: ['RULE-SET,pikpak,PikPak'],
  },
  
  {
    // ---- Financial 统一组（Phase 3 新增：Crypto + 传统金融合并） ----
    // 规则 = 原 Crypto 规则集（category-cryptocurrency）+ 自攒传统金融名单。
    // ⚠️ IBKR 建议用单一固定节点（手动选择，不开负载均衡/自动选择）：
    //    Client Portal 会话绑定出口 IP，多出口切换会导致 session 失效（官方文档警告）。
    //    MT5 只用域名规则：券商服务器分散在数百个机房 ASN，ASN 规则误伤严重且永远滞后。
    //    名单使用中逐步改进，缺口见金融素材文档（Mitrade/Tiger App 网关域名待抓包补充）。
    name: 'Financial',
    baseOption: selectBaseOption,
    defaultSelected: defaultSelectedMap.Financial,
    providers: {
      // --- 加密货币（沿用原 Crypto 规则集，v2fly 标准分类） ---
      cryptocurrency: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/category-cryptocurrency.mrs`,
        path: './ruleset/cryptocurrency.mrs',
        'path-in-bundle': 'geo/geosite/category-cryptocurrency.mrs',
      },
      // 注：bett-rules asn/ 目录无 IBKR/Firstrade 相关 ASN 数据，改用 IP-ASN 原生规则（需 geox-url.asn 数据库）。
    },
    icon: `${iconBaseUrl}Bitcoin.svg`,
    rules: [
      // 老虎证券国内版（laohu8.com）无交易功能，走直连；放最前避免被金融规则命中。
      'DOMAIN-SUFFIX,laohu8.com,DIRECT',
      // 加密货币
      'RULE-SET,cryptocurrency,Financial',
      // ---- IBKR（盈透证券）：交易通道 + 官网 + API，域名为主 ----
      'DOMAIN-SUFFIX,ibllc.com,Financial',
      'DOMAIN-SUFFIX,ibllc.com.cn,Financial',
      'DOMAIN-SUFFIX,ibkr.com,Financial',
      'DOMAIN-SUFFIX,interactivebrokers.com,Financial',
      'DOMAIN-SUFFIX,interactivebrokers.com.hk,Financial',
      'DOMAIN-SUFFIX,interactivebrokers.sg,Financial',
      'IP-ASN,27163,Financial,no-resolve',
      'IP-ASN,33121,Financial,no-resolve',
      'IP-ASN,40711,Financial,no-resolve',
      'IP-ASN,9468,Financial,no-resolve',
      // ---- MT5 / MetaQuotes：只用域名规则（券商服务器无法穷举，用户按开户券商自行补充） ----
      'DOMAIN-SUFFIX,metaquotes.net,Financial',
      'DOMAIN-SUFFIX,metatrader5.com,Financial',
      'DOMAIN-SUFFIX,metatrader4.com,Financial',
      'DOMAIN-SUFFIX,mql5.com,Financial',
      'DOMAIN-SUFFIX,mql4.com,Financial',
      'DOMAIN-SUFFIX,metaquotes.ltd,Financial',
      'DOMAIN-SUFFIX,cloud.mql5.com,Financial',
      // ---- TradingView：一条后缀全覆盖（行情 WebSocket 走代理保低延迟） ----
      'DOMAIN-SUFFIX,tradingview.com,Financial',
      // ---- Firstrade（第一证券） ----
      'DOMAIN-SUFFIX,firstrade.com,Financial',
      'IP-ASN,32699,Financial,no-resolve',
      // ---- Mitrade（无自有 ASN，切勿用 ASN 规则） ----
      'DOMAIN-SUFFIX,mitrade.com,Financial',
      'DOMAIN-SUFFIX,mitrade.eu,Financial',
      'DOMAIN-SUFFIX,mitradenews.com,Financial',
      // ---- 老虎证券国际版 ----
      'DOMAIN-SUFFIX,itiger.com,Financial',
      'DOMAIN-SUFFIX,openapi.tigerfintech.com,Financial',
      'DOMAIN-SUFFIX,openapi.tradeup.com,Financial',
      'DOMAIN-SUFFIX,tigersecurities.com,Financial',
      'DOMAIN-SUFFIX,tigerbrokers.com,Financial',
      'DOMAIN-SUFFIX,itigerup.com,Financial',
    ],
  },
  
  
  
  {
    name: 'AdBlock',
    baseOption: selectBaseOption,
    reject: true,
    providers: {
      'avenue-ads': {
        ...ruleProviderCommonDomain,
        // AWAvenue 秋风广告规则·完整版（广告+隐私+不受欢迎），替代原 geosite category-ads。
        // 项目地址：https://github.com/TG-Twilight/AWAvenue-Ads-Rule
        url: 'https://cdn.jsdelivr.net/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
        path: './ruleset/avenue-ads.mrs',
        'path-in-bundle': 'geo/geosite/avenue-ads.mrs',
      },
      // ---- 主防线其余组件（2026-10-30 新增）----
      // 规则不在本组 rules 里声明：统一由 main() 的主防线段前置到规则链最前，见 buildDefensePrefixRules。
      'defense-exceptions': {
        type: 'http',
        format: 'text',
        interval: 86400,
        behavior: 'classical',
        // 主防线例外名单（自有仓库 ruleset/，初始为空）：误杀域名在此加一行 DOMAIN-SUFFIX,域名 即放行。
        url: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/ruleset/defense-exceptions.list',
        path: './ruleset/defense-exceptions.list',
      },
      adrules: {
        ...ruleProviderCommonDomain,
        // AdRules 域名版（cats-team/AdRules 官方 mihomo 构建，约 20.5 万条）：防线主力，Disconnect 基准覆盖 53%。
        // 「完整防线」关停时由 buildRuleProviders 剔除本 provider（轻量模式）。
        url: 'https://cdn.jsdelivr.net/gh/cats-team/AdRules@main/mihomo/adrules-mihomo.mrs',
        path: './ruleset/adrules.mrs',
      },
      'native-vivo': {
        type: 'http',
        format: 'text',
        interval: 86400,
        behavior: 'domain',
        // HaGeZi Native·vivo 厂商遥测（自产：本仓库 Actions 每日从官方名单抽域名存 ruleset/*.txt，不经第三方转换仓）。
        url: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/ruleset/native-vivo.txt',
        path: './ruleset/native-vivo.txt',
      },
      'native-huawei': {
        type: 'http',
        format: 'text',
        interval: 86400,
        behavior: 'domain',
        // HaGeZi Native·华为厂商遥测（自产，同上）。
        url: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/ruleset/native-huawei.txt',
        path: './ruleset/native-huawei.txt',
      },
      banprogramad: {
        type: 'http',
        format: 'text',
        interval: 86400,
        behavior: 'classical',
        // BanProgramAD（tingxins 维护，约 990 条）：专打国产 App 统计/广告回传域名，外科手术式小表。
        url: 'https://cdn.jsdelivr.net/gh/tingxins/BanProgramAD@master/BanProgramAD.list',
        path: './ruleset/banprogramad.list',
      },
    },
    icon: `${iconBaseUrl}AdBlock.svg`,
    // 本组规则由 main() 主防线段统一前置，此处留空（avenue 亦在防线段内，不再走功能规则区）。
    rules: [],
  },
  // ---- Phase 2 新增：Cloudflare 策略组 ----
  // 设计冻结：手动 select，五地区组成员，Server.svg 图标，规则插 geolocation-!cn 之前。
  // 用途：Cloudflare  fronted 站点常弹验证，独立成组可手动指定低延迟地区，而非走默认代理。
  // ⚠️ 位置在 serviceConfigs 末尾：规则在服务域名规则之后、兜底之前，只接未认领流量（专属组优先）。
  {
    name: 'Cloudflare',
    baseOption: selectBaseOption,
    // 成员限定五个地区组（新命名），不跟随默认成员逻辑（含默认代理/全部节点）。
    fixedMembers: ['中国香港', '新加坡', '美国', '中国台湾', '日本'],
    providers: {
      cloudflare: {
        ...ruleProviderCommonIpcidr,
        url: `${ruleSetBaseUrl}geoip/cloudflare.mrs`,
        path: './ruleset/cloudflare.mrs',
        'path-in-bundle': 'geo/geoip/cloudflare.mrs',
      },
    },
    icon: 'https://cdn.jsdelivr.net/gh/gaomolan/MyClash-Rules@myclash-rules/Icons/svg/Cloudflare-v2.svg',
    rules: [
      // cloudflare@cn → 直连：CF 中国节点（中国 IP）优先直连，不进 Cloudflare 组。
      // cn_ip 规则集已在 baseRuleProviders 定义，此处复用；放在 CF IP 规则之前。
      'RULE-SET,cn_ip,直连',
      // CF 官方 IP 段（含 v4+v6），no-resolve 避免反向解析拖慢匹配。
      'RULE-SET,cloudflare,Cloudflare,no-resolve',
    ],
  },
];

/**
 * 适配 Bettbox 策略组开关
 * 声明哪些开关属于策略组：基础策略组 + 全部分流策略组。
 */
Compatible_With_Bettbox.policyGroupOptions = serviceConfigs.map((svc) => svc.name);

// ---节点过滤、重命名及验证---

/**
 * 节点匹配缓存，避免重复执行正则
 */
// 剥离节点名称中的零宽/不可见字符，仅用于匹配；不改写用户看到的节点名称。
const invisibleCharsRegex = /[\u00AD\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u115F\u1160\u3164\uFFA0]/g;
function toMatchableName(name) {
  return typeof name === 'string' ? name.replace(invisibleCharsRegex, '') : name;
}

const regionMatchCache = new Map();
function getMatchedRegions(proxyName) {
  if (regionMatchCache.has(proxyName)) {
    return regionMatchCache.get(proxyName);
  }

  const matchableName = toMatchableName(proxyName);
  const regions = allRegionDefinitions.filter((region) => region.regex.test(matchableName));
  regionMatchCache.set(proxyName, regions);

  return regions;
}

/**
 * 标准化节点名称：补全地区国旗、折叠多余空格，并预缓存匹配结果
 */
const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
function normalizeProxyName(proxy) {
  const originalName = proxy.name;

  const flag = originalName.match(flagRegex)?.[0];

  const nameWithoutFlag = (flag ? originalName.replace(flag, '') : originalName).replace(/\s+/g, ' ').trim();

  const matchedRegions = getMatchedRegions(originalName);

  const regionFlag = flag || matchedRegions.find((region) => region.flag)?.flag;

  const normalizedName = regionFlag ? `${regionFlag} ${nameWithoutFlag}` : nameWithoutFlag;

  if (normalizedName !== originalName) {
    regionMatchCache.set(normalizedName, matchedRegions);
  }

  return normalizedName === originalName ? proxy : { ...proxy, name: normalizedName };
}

/**
 * 修复 dialer-proxy 引用：目标被重命名则更新，被移除或不存在则删除引用
 */
function fixDialerProxy(proxy, renameMap, normalizedProxyNames) {
  const target = proxy['dialer-proxy'];
  if (!target) return proxy;

  if (renameMap.has(target)) {
    return { ...proxy, 'dialer-proxy': renameMap.get(target) };
  }

  if (normalizedProxyNames.has(target)) {
    return proxy;
  }

  const copy = { ...proxy };
  delete copy['dialer-proxy'];
  return copy;
}

/**
 * 读取代理 IP 版本偏好：仅其中一个开关开启时返回对应偏好，
 * 同时开启或同时关闭时返回 null（不应用任何偏好，节点保持原样）
 */
function getIpVersionPreference() {
  const ipv4PreferEnabled = ruleOptionsEnable.代理IPV4优先;
  const ipv6PreferEnabled = ruleOptionsEnable.代理IPV6优先;

  if (ipv4PreferEnabled && !ipv6PreferEnabled) return 'ipv4-prefer';
  if (ipv6PreferEnabled && !ipv4PreferEnabled) return 'ipv6-prefer';
  return null;
}

/**
 * 过滤并标准化节点：剔除内置/信息节点、按配置过滤、去重、修复 dialer-proxy 引用，空列表时抛错
 */
function filterAndNormalizeProxies(config) {
  regionMatchCache.clear();

  const showLowRateProxiesEnabled = ruleOptionsEnable.显示低倍率节点;
  const showHighRateProxiesEnabled = ruleOptionsEnable.显示高倍率节点;
  // 旧开关：过滤开关开，则从节点列表中过滤掉对应倍率节点
  const filterLowRateProxiesEnabled = ruleOptionsEnable.过滤低倍率节点;
  const filterHighRateProxiesEnabled = ruleOptionsEnable.过滤高倍率节点;
  const filterNonRegionProxiesEnabled = ruleOptionsEnable.过滤非地区节点;

  const lowRateRegex = filterLowRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex
    : null;
  const highRateRegex = filterHighRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === highRateRegionName)?.regex
    : null;

  const originalProxies = config.proxies || [];

  const filteredRawProxies = originalProxies.filter((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') return false;

    const matchableName = toMatchableName(proxy.name);
    if (lowRateRegex?.test(matchableName) || highRateRegex?.test(matchableName)) return false;

    if (!filterNonRegionProxiesEnabled) return true;

    const isRegionProxy = getMatchedRegions(proxy.name).some((region) => regionDefinitions.includes(region));

    return isRegionProxy || !excludeFilter.test(matchableName);
  });

  const renameMap = new Map();
  const normalizedProxies = [];
  const uniqueNames = new Set();

  for (const rawProxy of filteredRawProxies) {
    const normalized = normalizeProxyName(rawProxy);
    if (normalized.name !== rawProxy.name) {
      renameMap.set(rawProxy.name, normalized.name);
    }
    if (!uniqueNames.has(normalized.name)) {
      uniqueNames.add(normalized.name);
      normalizedProxies.push(normalized);
    }
  }

  const normalizedProxyNames = new Set(normalizedProxies.map((p) => p.name));

  const filteredProxies = normalizedProxies.map((proxy) => fixDialerProxy(proxy, renameMap, normalizedProxyNames));

  if (!filteredProxies.length) {
    throw new Error('配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写');
  }

  const ipVersionPreference = getIpVersionPreference();
  if (ipVersionPreference) {
    return filteredProxies.map((proxy) =>
      proxy['ip-version'] === ipVersionPreference ? proxy : { ...proxy, 'ip-version': ipVersionPreference },
    );
  }

  return filteredProxies;
}

// ---构建地区组和倍率组---

/**
 * 构建地区策略组，可附带自动选择组
 */
/**
 * 构建地区策略组，可附带自动选择组与地区低倍率自动选择组。
 *
 * 地区低倍率自动选择（Phase 3 原生集成，原 customPatch.js 包装逻辑改为内置实现）：
 * 对五大地区组，用低倍率正则过滤该地区节点，生成 `{地区}-Eco-Auto`（url-test，
 * hidden:true），并挂入地区组的可选项。倍率组与"其他节点"不生成（无意义）。
 * 修复原补丁 bug：原补丁用"台湾省"匹配上游"台湾"导致台湾组从未生成；现用地区注册表
 * 名称直接比对，不再依赖外部硬编码名单。
 */
function createRegionGroup(name, icon, proxies, hidden = false) {
  const generateRegionAutoSelectEnabled = ruleOptionsEnable.生成地区自动选择组;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;
  const generateRateGroupsEnabled = ruleOptionsEnable.生成倍率组 !== false; // 关则不生成 Eco-Auto 等倍率组

  const groups = [];
  const selectProxies = [...proxies];

  // ---- 地区低倍率自动选择 ----
  // 性能原则：lowRateRegex 为模块级不变数据，循环外一次求值（rateRegionDefinitions 静态）。
  const isMainRegion = regionDefinitions.some((r) => r.name === name);
  if (isMainRegion && generateRateGroupsEnabled) {
    const lowRateRegex = rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex;
    const lowRateProxies = lowRateRegex ? proxies.filter((n) => lowRateRegex.test(n)) : [];
    if (lowRateProxies.length > 0) {
      const lowRateAutoName = `${name}-Eco-Auto`;
      groups.push({
        ...urlTestBaseOption,
        name: lowRateAutoName,
        proxies: lowRateProxies,
        icon: `${iconBaseUrl}Available.svg`,
        hidden: true, // 隐藏：主界面只显示地区组，点进去再选低倍率自动选择
      });
      selectProxies.push(lowRateAutoName);
    }
  }

  if (generateRegionAutoSelectEnabled) {
    const urlTestName = `${name}-Auto`;
    groups.push({
      ...urlTestBaseOption,
      name: urlTestName,
      proxies,
    });
    selectProxies.push(urlTestName);
  }

  groups.push({
    ...selectBaseOption,
    name,
    icon,
    proxies: selectProxies,
    hidden: hidden || hideManualSelectGroupEnabled,
  });

  return groups;
}

/**
 * 将节点按地区/倍率归类，构建地区策略组、倍率策略组与“其他节点”组
 */
function buildRegionGroups(filteredProxies, customProxies) {
  const showLowRateGroupEnabled = ruleOptionsEnable.显示低倍率节点;
  const showHighRateGroupEnabled = ruleOptionsEnable.显示高倍率节点;
  const generateRateGroupsEnabled = ruleOptionsEnable.生成倍率组 !== false; // 关则不生成低倍率/高倍率节点组

  const regionGroups = Object.fromEntries(allRegionDefinitions.map(({ name }) => [name, []]));
  const otherProxies = [];
  // 性能原则：不变数据提至循环外 —— Set 查找 O(1)，避免逐节点线性扫描
  const regionDefSet = new Set(regionDefinitions);

  for (const proxy of [...filteredProxies, ...customProxies]) {
    const matchedRegions = getMatchedRegions(proxy.name);
    const isRegionProxy = matchedRegions.some((region) => regionDefSet.has(region));

    for (const region of matchedRegions) {
      regionGroups[region.name].push(proxy.name);
    }

    if (!isRegionProxy) {
      otherProxies.push(proxy.name);
    }
  }

  const generatedRegionGroups = (generateRateGroupsEnabled ? allRegionDefinitions : regionDefinitions)
    .filter((r) => regionGroups[r.name].length > 0)
    .flatMap((r) => {
      // 倍率组：显示开关控制 hidden 属性（隐藏而非删除，组依然可用）
      let hidden = false;
      if (r.name === lowRateRegionName) hidden = !showLowRateGroupEnabled;
      if (r.name === highRateRegionName) hidden = !showHighRateGroupEnabled;
      return createRegionGroup(r.name, r.icon, regionGroups[r.name], hidden);
    });

  if (otherProxies.length > 0) {
    generatedRegionGroups.push(...createRegionGroup('其他节点', `${iconBaseUrl}WorldMap.svg`, otherProxies));
  }

  return generatedRegionGroups;
}

// ===== [组合脚本专属] Spark 组合池 =====

/**
 * [组合脚本专属] 把过滤后的节点拆成三份：
 * - generalProxies：非 Spark 节点 —— 通用分组池（地区组 / Auto / 手动选择等全部由此构建，
 *   从而任何通用组都不会显示 Spark 节点）；
 * - sparkProxies：保留地区（港/新）的 Spark 节点 —— 只进 Spark 专属组；
 * - keptProxies：最终保留的全部订阅节点（general + spark），供 DNS/hosts 处理与写回配置。
 * 其他地区的 Spark 节点不进任何一份，直接剔除。
 */
function splitComboSparkProxies(proxies) {
  const generalProxies = [];
  const sparkProxies = [];
  for (const proxy of proxies) {
    if (!proxy.name.includes(COMBO_SPARK_TAG)) {
      generalProxies.push(proxy);
      continue;
    }
    const matchedNames = getMatchedRegions(proxy.name).map((r) => r.name);
    if (matchedNames.some((n) => COMBO_SPARK_KEEP_REGIONS.includes(n))) {
      sparkProxies.push(proxy);
    }
    // 未命中保留地区的 Spark 节点：剔除，不进最终配置
  }
  return { generalProxies, sparkProxies, keptProxies: [...generalProxies, ...sparkProxies] };
}

/**
 * [组合脚本专属] Spark 地区组：结构与普通地区组同构（手动组 + Auto + Eco-Auto），
 * 遵循相同的开关（生成地区自动选择组 / 生成倍率组 / 隐藏地区手动选择组）。
 * 不能直接复用 createRegionGroup：其 Eco-Auto 仅对主地区名生成，Spark- 前缀名不在地区注册表内。
 */
function createComboSparkRegionGroup(name, icon, proxies) {
  const generateRegionAutoSelectEnabled = ruleOptionsEnable.生成地区自动选择组;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;
  const generateRateGroupsEnabled = ruleOptionsEnable.生成倍率组 !== false;

  const groups = [];
  const selectProxies = [...proxies];

  if (generateRateGroupsEnabled) {
    const lowRateRegex = rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex;
    const lowRateProxies = lowRateRegex ? proxies.filter((n) => lowRateRegex.test(n)) : [];
    if (lowRateProxies.length > 0) {
      const lowRateAutoName = `${name}-Eco-Auto`;
      groups.push({
        ...urlTestBaseOption,
        name: lowRateAutoName,
        proxies: lowRateProxies,
        icon: `${iconBaseUrl}Available.svg`,
        hidden: true,
      });
      selectProxies.push(lowRateAutoName);
    }
  }

  if (generateRegionAutoSelectEnabled) {
    const urlTestName = `${name}-Auto`;
    groups.push({
      ...urlTestBaseOption,
      name: urlTestName,
      proxies,
    });
    selectProxies.push(urlTestName);
  }

  groups.push({
    ...selectBaseOption,
    name,
    icon,
    proxies: selectProxies,
    hidden: hideManualSelectGroupEnabled,
  });

  return groups;
}

/**
 * [组合脚本专属] 按保留地区构建 Spark 专属组，返回生成的组与手动组名（供 AI / Claude / Financial / Cloudflare 组拼成员）。
 */
function buildComboSparkGroups(sparkProxies) {
  const groups = [];
  const selectNames = [];
  for (const regionName of COMBO_SPARK_KEEP_REGIONS) {
    const nodes = sparkProxies
      .filter((p) => getMatchedRegions(p.name).some((r) => r.name === regionName))
      .map((p) => p.name);
    if (nodes.length === 0) continue;
    const groupName = `Spark-${regionName}`;
    const region = allRegionDefinitions.find((r) => r.name === regionName);
    groups.push(...createComboSparkRegionGroup(groupName, region?.icon, nodes));
    selectNames.push(groupName);
  }
  return { groups, selectNames };
}

// ---构建自定义节点组---


/**
 * 处理自定义节点：标准化名称、与订阅节点重名时添加“自建-”前缀、内部去重，
 * 并构建“自建节点”策略组。
 * 自定义节点不参与订阅节点过滤，也不参与 hosts 改写及 DNS 域名处理。
 */
function buildCustomizeGroups(filteredProxies, customizeList = customizeProxies) {
  if (!customizeList.length) {
    return { customProxies: [], customProxyNames: [], customGroup: null };
  }

  const usedNames = new Set(filteredProxies.map((p) => p.name));
  const customPrefix = '自建-';
  const customProxies = [];

  for (const proxy of customizeList) {
    const normalized = normalizeProxyName(proxy);
    let name = normalized.name;
    while (usedNames.has(name)) {
      name = normalizeProxyName({ name: `${customPrefix}${name}` }).name.replace(`${customPrefix} `, customPrefix);
    }
    usedNames.add(name);

    customProxies.push(name === normalized.name ? normalized : { ...normalized, name });
  }

  const customProxyNames = customProxies.map((p) => p.name);

  const customGroup = {
    ...selectBaseOption,
    name: '自建节点',
    proxies: customProxyNames,
    icon: `${iconBaseUrl}Server.svg`,
  };

  return {
    customProxies,
    customProxyNames,
    customGroup,
  };
}

// ---构建基础策略组和分流策略组---

/**
 * 构建基础/分流策略组/部分节点组、GLOBAL 组与规则集，并汇总分流规则
 */
/**
 * 构建函数共享上下文：各子函数共用的派生数据，一次计算，多处复用。
 * （性能原则：不变数据提至循环外，避免各函数重复计算）
 */
function buildFunctionalContext(filteredProxies, generatedRegionGroups, customizeInfo) {
  const { customProxyNames = [], customGroup = null } = customizeInfo || {};
  const filteredProxyNames = filteredProxies.map((p) => p.name);
  const allProxiesNames = [...filteredProxyNames, ...customProxyNames];
  const groupNamesOfSelect = generatedRegionGroups.filter((g) => g.type === 'select').map((g) => g.name);
  const baseGroupNames = baseGroups.filter((g) => ruleOptionsEnable[g.name]).map((g) => g.name);
  const customGroupNames = customGroup ? [customGroup.name] : [];
  return { filteredProxyNames, allProxiesNames, groupNamesOfSelect, baseGroupNames, customGroupNames, customGroup };
}

/**
 * 组装代理组：默认代理 / 各服务组 / 漏网之鱼 / 直连 / GLOBAL。
 * 只负责 proxy-groups，不管规则与规则集。
 */
function buildServiceGroups(ctx) {
  const addAllNodesToServiceGroupsEnabled = ruleOptionsEnable.分流组添加所有节点;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;
  const { allProxiesNames, groupNamesOfSelect, baseGroupNames, customGroupNames } = ctx;

  const functionalGroups = [];

  functionalGroups.push({
    ...selectBaseOption,
    name: '默认代理',
    proxies: [...groupNamesOfSelect, ...baseGroupNames, ...customGroupNames],
    icon: `${iconBaseUrl}Proxy.svg`,
  });

  for (const svc of serviceConfigs) {
    if (ruleOptionsEnable[svc.name] === false) continue;

    let groupProxies = [];
    if (svc.fixedMembers) {
      // 固定成员组（如 Cloudflare）：仅含指定地区组，不跟随默认成员逻辑。
      // 过滤掉无节点未生成的地区组，避免引用不存在的组名。
      // 另加「手动选择」和「默认代理」方便兜底。
      const existingNames = new Set(ctx.generatedRegionGroupNames);
      const members = svc.fixedMembers.filter((n) => existingNames.has(n));
      groupProxies = ['手动选择', '默认代理', ...members];
    } else if (svc.includeAll) {
      groupProxies = [...allProxiesNames];
    } else if (svc.reject) {
      groupProxies = ['REJECT', 'REJECT-DROP', 'PASS'];
    } else {
      groupProxies = !addAllNodesToServiceGroupsEnabled
        ? ['默认代理', ...customGroupNames, ...baseGroupNames, ...groupNamesOfSelect, ...(svc.direct ? ['直连'] : [])]
        : [
            '默认代理',
            ...customGroupNames,
            ...baseGroupNames,
            ...groupNamesOfSelect,
            ...allProxiesNames,
            ...(svc.direct ? ['直连'] : []),
          ];
    }

    // [组合脚本专属] AI / Claude / Financial 组：Spark 专属组排到成员最前（默认选中保持不变，用户手动切）
    if ((svc.name === 'AI' || svc.name === 'Claude' || svc.name === 'Financial') && ctx.comboSparkSelectNames?.length) {
      groupProxies = [...ctx.comboSparkSelectNames, ...groupProxies];
    }
    // [组合脚本专属] Cloudflare 组（固定成员且无默认选中，默认落点是首位的手动选择）：
    // Spark 专属组插在手动选择/默认代理之后，只多两个可选项，不改默认落点。
    if (svc.name === 'Cloudflare' && ctx.comboSparkSelectNames?.length) {
      groupProxies = [...groupProxies.slice(0, 2), ...ctx.comboSparkSelectNames, ...groupProxies.slice(2)];
    }

    functionalGroups.push({
      ...svc.baseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: groupProxies,
      ...(svc.defaultSelected !== undefined && {
        'default-selected': svc.defaultSelected,
      }),
    });
  }

  functionalGroups.push({
    ...selectBaseOption,
    name: '漏网之鱼',
    proxies: ['默认代理', '直连', ...groupNamesOfSelect],
    icon: `${iconBaseUrl}Stack.svg`,
  });

  const directGroup = {
    ...selectBaseOption,
    name: '直连',
    proxies: [...directProxies.map((p) => p.name)],
    icon: `${iconBaseUrl}China.svg`,
    hidden: hideManualSelectGroupEnabled,
  };

  // GLOBAL 名单精简：全局模式下 GLOBAL 是「总出口候选名单」，只放顶层组与
  // 地区组本体，不再平铺全部功能组与地区子组——
  // · 服务组（AI / Financial 等）与漏网之鱼不进：全局选它们等于全流量走其当前
  //   节点，而该节点经地区组 / 手动选择同样可选，属重复入口；
  // · 地区组只取 select 本体（groupNamesOfSelect），-Auto / -Eco-Auto 等子组
  //   不进：点进地区组本体照样可选，组本身不删，零功能损失；
  // · [组合脚本专属] Spark 专属组同理只进手动组本体（comboSparkSelectNames）。
  // 默认代理保持第一位：它同时是切到全局模式时的默认落点。
  const globalBaseOrder = ['Auto', '负载均衡', '手动选择'];
  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      '默认代理',
      ...globalBaseOrder.filter((n) => baseGroupNames.includes(n)),
      ...baseGroupNames.filter((n) => !globalBaseOrder.includes(n)),
      ...groupNamesOfSelect,
      ...(ctx.comboSparkSelectNames || []),
      ...customGroupNames,
      directGroup.name,
    ],
    icon: `${iconBaseUrl}Global.svg`,
  };

  return { functionalGroups, directGroup, globalGroup };
}

// ---- 主防线定点段（2026-10-30）----
// 离线全集比对确认的主流名单均未覆盖、且确属广告/统计回传的域名，手写定点拦截。
// 只用 DOMAIN-SUFFIX 精确到回传域，不碰厂商主服务域（如个推主通道 sdk.open.talk.getui.net 是推送传输、禁拦）。
const DEFENSE_SPOT_RULES = [
  'DOMAIN-SUFFIX,pangle.cn,AdBlock', // 穿山甲广告主域
  'DOMAIN-SUFFIX,sensorsdata.cn,AdBlock', // 神策数据回传
  'DOMAIN-SUFFIX,ulog.sv.qq.com,AdBlock', // 腾讯灯塔统计回传（子域级，不碰 qq.com 主域面）
];

/**
 * 主防线段：把防线规则插进 prefixRules 的 private 之后、geolocation-cn 之前返回。
 * 为什么必须在 geolocation-cn 之前：prefixRules 里的国内分流名单（geolocation-cn / games_cn 等
 *   DIRECT 规则）会抢先认领被 SDK 污染的 .cn 域名，防线排在功能规则区时拦不住它们（2026-10-30 审计 F1）。
 * 段内顺序即优先级：例外名单（直连，先行放行）→ avenue → AdRules（仅完整防线）→ 厂商遥测 → BanProgramAD → 定点段。
 * AdBlock 组关停时整段不插入（providers 亦由 buildRuleProviders 同步跳过）。
 * ⚠️ AdRules 含 HTTPDNS 域名（33 个 + dns.weixin.qq.com.cn）：拦截后 App 回落系统 DNS，
 *   与本脚本「DNS 归脚本」一致；微信/B站/美团出现解析异常时，先把对应域名加进例外名单。
 */
function buildDefensePrefixRules() {
  if (ruleOptionsEnable.AdBlock === false) return [...prefixRules];
  const defense = [
    'RULE-SET,defense-exceptions,直连',
    'RULE-SET,avenue-ads,AdBlock',
    ...(ruleOptionsEnable.完整防线 !== false ? ['RULE-SET,adrules,AdBlock'] : []),
    'RULE-SET,native-vivo,AdBlock',
    'RULE-SET,native-huawei,AdBlock',
    'RULE-SET,banprogramad,AdBlock',
    ...DEFENSE_SPOT_RULES,
  ];
  const idx = prefixRules.indexOf('RULE-SET,private,直连');
  if (idx === -1) return [...defense, ...prefixRules];
  return [...prefixRules.slice(0, idx + 1), ...defense, ...prefixRules.slice(idx + 1)];
}

/**
 * 组装规则：按 serviceConfigs 定义顺序收集各服务组规则。
 * AdBlock 优先（广告规则先行），其余按定义顺序。
 * 只负责 rules 数组，不管组与规则集。
 */
function buildServiceRules() {
  const functionalRules = [];
  const orderedServiceConfigs = [
    ...serviceConfigs.filter((svc) => svc.name === 'AdBlock'),
    ...serviceConfigs.filter((svc) => svc.name !== 'AdBlock'),
  ];
  for (const svc of orderedServiceConfigs) {
    if (ruleOptionsEnable[svc.name] === false) continue;
    functionalRules.push(...(svc.rules || []));
  }
  return functionalRules;
}

/**
 * 组装规则集 providers：base + 各服务组 providers 合并。
 * 只负责 rule-providers，不管组与规则。
 */
function buildRuleProviders() {
  const blockForeignQuicEnabled = ruleOptionsEnable.屏蔽国外QUIC;
  const finalRuleProviders = { ...baseRuleProviders };

  if (!blockForeignQuicEnabled) {
    delete finalRuleProviders.cn_additional;
  }

  for (const svc of serviceConfigs) {
    if (ruleOptionsEnable[svc.name] === false) continue;
    Object.assign(finalRuleProviders, svc.providers || {});
  }

  // 主防线轻量模式：「完整防线」关停时剔除 AdRules provider，其余防线组件保留。
  if (ruleOptionsEnable.完整防线 === false) {
    delete finalRuleProviders.adrules;
  }

  return finalRuleProviders;
}

/**
 *  functionalGroups 总装：三个子函数各管一摊，此处只做编排。
 * （Phase 3 拆分：原 136 行单体函数拆为上下文 + 三个构建函数 + 编排器）
 */
function buildFunctionalGroups(filteredProxies, generatedRegionGroups, customizeInfo) {
  const ctx = buildFunctionalContext(filteredProxies, generatedRegionGroups, customizeInfo);
  // [组合脚本专属] Spark 专属组名透传给 buildServiceGroups（供 AI / Claude / Financial / Cloudflare 组拼成员）
  ctx.comboSparkSelectNames = customizeInfo?.comboSparkSelectNames || [];
  // fixedMembers 过滤需要地区组名集合，补入上下文
  ctx.generatedRegionGroups = generatedRegionGroups;
  ctx.generatedRegionGroupNames = new Set(generatedRegionGroups.map((g) => g.name));

  const { functionalGroups, directGroup, globalGroup } = buildServiceGroups(ctx);
  const functionalRules = buildServiceRules();
  const finalRuleProviders = buildRuleProviders();

  return { globalGroup, functionalGroups, functionalRules, finalRuleProviders, directGroup };
}

// ---dns和hosts相关处理---

// 常见的公共 DNS，用于过滤订阅中的公共 DNS
const commonDnsList = [
  // ==================== 国内 ====================

  // 阿里 AliDNS（阿里云）
  '223.5.5.5',
  '223.6.6.6',
  '2400:3200::1',
  '2400:3200:baba::1',
  'alidns',

  // 腾讯 DNSPod（腾讯云）
  '119.29.29.29',
  '182.254.116.116',
  '1.12.12.12',
  '120.53.53.53',
  '2402:4e00::',
  'doh.pub',
  'dot.pub',
  'dns.pub',
  'dnspod',

  // 114DNS（南京信风）
  '114.114.114.114',
  '114.114.115.115',

  // 百度 BaiduDNS
  '180.76.76.76',
  '2400:da00::6666',
  'dns.baidu',

  // CNNIC SDNS（中国互联网络信息中心）
  '1.2.4.8',
  '210.2.4.8',
  '2001:dc7:1000::1',
  'cnnic',

  // 360 安全 DNS
  '101.226.4.6',
  '218.30.118.6',
  '123.125.81.6',
  '2400:8800:1::6',
  '2400:8800:2::6',
  'doh.360',
  'dot.360',

  // 火山引擎（字节跳动）
  '180.184.1.1',
  '180.184.2.2',

  // ==================== 国外 ====================

  // Cloudflare
  '1.1.1.1',
  '1.0.0.1',
  '1.1.1.2',
  '1.0.0.2',
  '1.1.1.3',
  '1.0.0.3',
  '2606:4700:4700::1111',
  '2606:4700:4700::1001',
  '2606:4700:4700::1112',
  '2606:4700:4700::1002',
  '2606:4700:4700::1113',
  '2606:4700:4700::1003',
  'dns.cloudflare',
  'cloudflare-dns',
  'one.one.one.one',

  // Google Public DNS
  '8.8.8.8',
  '8.8.4.4',
  '2001:4860:4860::8888',
  '2001:4860:4860::8844',
  'dns.google',

  // Quad9
  '9.9.9.9',
  '9.9.9.10',
  '9.9.9.11',
  '149.112.112.112',
  '149.112.112.10',
  '149.112.112.11',
  '2620:fe::fe',
  '2620:fe::9',
  'quad9',

  // Cisco OpenDNS（含 FamilyShield）
  '208.67.222.222',
  '208.67.220.220',
  '208.67.222.123',
  '208.67.220.123',
  '2620:119:35::35',
  '2620:119:53::53',
  '2620:119:35::123',
  '2620:119:53::123',
  'opendns',

  // AdGuard DNS（含家庭版）
  '94.140.14.14',
  '94.140.15.15',
  '94.140.14.15',
  '94.140.15.16',
  '2a10:50c0::ad1:ff',
  '2a10:50c0::ad2:ff',
  '2a10:50c0::bad1:ff',
  '2a10:50c0::bad2:ff',
  'adguard',

  // Control D
  '76.76.2.0',
  '76.76.10.0',
  '76.76.19.19',
  '76.223.122.150',
  '2a0d:2a00:1::2',
  '2a0d:2a00:2::2',

  // CleanBrowsing（含安全/家庭版）
  '185.228.168.9',
  '185.228.169.9',
  '185.228.168.10',
  '185.228.169.11',
  '185.228.168.168',
  '185.228.169.168',

  // Yandex DNS
  '77.88.8.8',
  '77.88.8.1',
  '2a02:6b8::feed:0ff',
  '2a02:6b8:0:1::feed:0ff',

  // Neustar UltraDNS
  '156.154.70.1',
  '156.154.71.1',
  '156.154.70.2',
  '156.154.71.2',
  '2610:a1:1018::1',
  '2610:a1:1019::1',

  // Mullvad DNS
  '194.242.2.2',
  '2a07:e340::2',

  // Hurricane Electric
  '74.82.42.42',
  '2001:470:20::2',

  // NextDNS
  'nextdns',

  // Apple
  'dns.apple',
];

// 预编译公共 DNS 正则
const commonDnsRegex = new RegExp(
  commonDnsList.map((dns) => dns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

// 国内外 DNS 定义
const chinaDNS = ['119.29.29.29#DIRECT', '114.114.114.114#DIRECT'];
const foreignDNS = ['https://cloudflare-dns.com/dns-query#默认代理', 'https://dns.google/dns-query#默认代理'];
const defaultDNS = ['114.114.114.114#DIRECT', 'https://1.12.12.12/dns-query#DIRECT'];
const proxyServerDNS = ['114.114.114.114#DIRECT', 'https://doh.pub/dns-query#DIRECT'];

/**
 * hosts 匹配优先级：精确 > +. > . > *（同级按出现顺序）
 */
function hostSpecificity(pattern) {
  if (pattern.startsWith('+.')) return 2;
  if (pattern.startsWith('.')) return 1;
  if (pattern.includes('*')) return 0;
  return 3;
}

/**
 * 判断域名规则（精确/通配）是否匹配节点域名集合，忽略大小写
 */
function matchDomainPattern(pattern, domains) {
  pattern = pattern.toLowerCase();

  // 精确匹配
  if (!pattern.includes('*') && !pattern.startsWith('+.') && !pattern.startsWith('.')) {
    return typeof domains === 'string'
      ? domains.toLowerCase() === pattern
      : [...domains].some((d) => d.toLowerCase() === pattern);
  }

  const domainList = typeof domains === 'string' ? [domains.toLowerCase()] : [...domains].map((d) => d.toLowerCase());

  // +.example.com
  if (pattern.startsWith('+.')) {
    const suffix = pattern.slice(2);
    return domainList.some((domain) => domain === suffix || domain.endsWith(`.${suffix}`));
  }

  // .example.com
  if (pattern.startsWith('.')) {
    const suffix = pattern.slice(1);
    return domainList.some((domain) => domain !== suffix && domain.endsWith(`.${suffix}`));
  }

  // *.example.com、example.*.com 等
  const patternParts = pattern.split('.');
  return domainList.some((domain) => {
    const domainParts = domain.split('.');
    return (
      patternParts.length === domainParts.length &&
      patternParts.every((part, index) => part === '*' || part === domainParts[index])
    );
  });
}

/**
 * 根据订阅 hosts 映射改写节点 server，改写后无需再复制 hosts 进新配置。
 * 支持链式映射（如 a: b、b: c 时节点 a 改写为 c）；
 * 回环映射（a: b、b: a）由内核校验拒绝，此处仅以已访问集合防御性终止
 */
function applyHostsToProxies(proxies, hosts) {
  if (!hosts || typeof hosts !== 'object') return proxies;

  const hostEntries = Object.entries(hosts)
    .filter(
      ([, value]) => (typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0),
    )
    .sort((a, b) => hostSpecificity(b[0]) - hostSpecificity(a[0]));

  if (hostEntries.length === 0) return proxies;

  const targetOf = (value) => {
    if (Array.isArray(value)) value = value.find((v) => typeof v === 'string' && v.length > 0);
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  const resolveCache = new Map();
  const resolve = (server) => {
    const cached = resolveCache.get(server);
    if (cached !== undefined) return cached;

    const seen = new Set();
    let current = server.toLowerCase();
    let result = server;
    while (!seen.has(current)) {
      seen.add(current);
      const entry = hostEntries.find(([pattern]) => matchDomainPattern(pattern, current));
      const target = entry && targetOf(entry[1]);
      if (!target) break;
      result = target;
      current = target.toLowerCase();
    }
    resolveCache.set(server, result);
    return result;
  };

  return proxies.map((proxy) => {
    if (typeof proxy.server !== 'string') return proxy;
    const server = resolve(proxy.server);
    return server === proxy.server ? proxy : { ...proxy, server };
  });
}

/**
 * 剥离 DNS 地址的 # 策略组后缀；
 * 参数包含 direct 或 直连 时，强制改为 #DIRECT
 */
function stripDnsSuffix(dns) {
  const str = String(dns);
  const hashIndex = str.indexOf('#');
  if (hashIndex === -1) return str;

  const prefix = str.slice(0, hashIndex).trim();

  const suffix = str
    .slice(hashIndex + 1)
    .toLowerCase()
    .trim();

  if (suffix.includes('direct') || suffix.includes('直连')) return prefix + '#DIRECT';

  return prefix;
}

/**
 * 判断节点 server 是否为 IP 地址（IPv4 / IPv6），用于从节点域名集合中排除 IP 类型的 server
 */
function isIpAddress(server) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(server) || server.includes(':');
}

/**
 * 简化节点域名策略：将相同 DNS 的节点域名按后缀归类，至少三段的域名可合并为 +. 后缀形式
 */
function simplifyDomainPolicy(policy) {
  const groups = new Map();

  for (const [domain, dns] of Object.entries(policy)) {
    const dnsKey = JSON.stringify(Array.isArray(dns) ? [...dns].sort() : dns);

    if (domain.startsWith('+.') || domain.startsWith('.') || domain.includes('*')) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const parts = domain.split('.');

    if (parts.length < 3) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const suffix = parts.slice(-2).join('.');

    if (!groups.has(suffix)) {
      groups.set(suffix, []);
    }

    groups.get(suffix).push({ domain, dns, dnsKey });
  }

  const result = {};

  for (const [suffix, domains] of groups) {
    const firstDnsKey = domains[0].dnsKey;
    const sameDns = domains.every(({ dnsKey }) => dnsKey === firstDnsKey);

    if (domains.length >= 2 && sameDns) {
      result[`+.${suffix}`] = domains[0].dns;
    } else {
      for (const { domain, dns } of domains) {
        result[domain] = dns;
      }
    }
  }

  return result;
}

/**
 * 构建 DNS 与 hosts：保留私有 DNS、节点域名 policy/fake-ip-filter，并按 hosts 改写节点 server
 * hosts改写条件（满足任意一个条件即可）：
 * 1. proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含非空的 listen 值
 * 2. proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含 127.0.0.1 并且 listen 包含 0.0.0.0
 */
function buildDnsAndHostsConfig(config, filteredProxies) {
  const originalDnsConfig = config.dns || {};

  const proxyServerNameservers = originalDnsConfig['proxy-server-nameserver'] || [];
  const listenValue = originalDnsConfig['listen'];

  const shouldRewriteByHosts =
    proxyServerNameservers.length === 1 &&
    typeof listenValue === 'string' &&
    listenValue.length > 0 &&
    (proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes(listenValue.toLowerCase())) ||
      (listenValue.includes('0.0.0.0') &&
        proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes('127.0.0.1'))));

  const mappedProxies = shouldRewriteByHosts ? applyHostsToProxies(filteredProxies, config.hosts) : filteredProxies;

  const proxyDomains = new Set(
    mappedProxies
      .filter((proxy) => typeof proxy.server === 'string')
      .map((proxy) => proxy.server.toLowerCase())
      .filter((server) => !isIpAddress(server)),
  );

  const privateProxyServerNameservers = shouldRewriteByHosts ? [] : proxyServerNameservers;

  const isCommonDns = (dns) => {
    const value = String(dns).trim().toLowerCase();
    if (value === 'system' || value === 'system://') return true;

    return commonDnsRegex.test(value);
  };

  const privateDNS = [
    ...new Set(
      [...(originalDnsConfig['nameserver'] || []), ...privateProxyServerNameservers]
        .map(stripDnsSuffix)
        .filter((dns) => dns.length > 0 && !isCommonDns(dns)),
    ),
  ];

  const matchedProxyPolicy = {};
  for (const [domain, dns] of Object.entries({
    ...originalDnsConfig['nameserver-policy'],
    ...originalDnsConfig['proxy-server-nameserver-policy'],
  })) {
    if (!matchDomainPattern(domain, proxyDomains)) continue;

    const stripedDns = Array.isArray(dns) ? dns.map(stripDnsSuffix).filter((d) => d.length > 0) : stripDnsSuffix(dns);
    if (Array.isArray(stripedDns) && stripedDns.length === 0) continue;

    matchedProxyPolicy[domain] = stripedDns;
  }

  if (privateDNS.length > 0 && Object.keys(matchedProxyPolicy).length === 0) {
    for (const domain of proxyDomains) {
      matchedProxyPolicy[domain] = privateDNS;
    }
  }

  const matchedPolicyDomains = Object.keys(matchedProxyPolicy);
  const proxyServerPolicy =
    proxyDomains.size === matchedPolicyDomains.length &&
    matchedPolicyDomains.every((domain) => proxyDomains.has(domain.toLowerCase()))
      ? simplifyDomainPolicy(matchedProxyPolicy)
      : matchedProxyPolicy;

  const originalFakeIpFilter = originalDnsConfig['fake-ip-filter'] || [];
  const proxyFakeIpFilter = originalFakeIpFilter.filter((pattern) => {
    const p = String(pattern);
    return matchDomainPattern(p, proxyDomains);
  });

  const dns = {
    enable: true,
    // ⚠️ dns.ipv6 由「IPv6总开关」与「WebRTC走代理」共同决定（与逻辑）：
    //   仅当 IPv6总开关开 且 WebRTC走代理关 时为 true；其余情况均为 false。
    //   WebRTC 防护优先：开着「WebRTC走代理」时，即使开了 IPv6总开关，DNS 也不走 IPv6，
    //   防止 STUN 经 IPv6 通道直连泄露真实 IP（移动网 IPv6 直连是已知泄露路径）。
    //   顶层 ipv6 留空交 App 接管，此处只管 DNS 解析是否走 IPv6。
    ipv6: ruleOptionsEnable.IPv6总开关 === true && ruleOptionsEnable.WebRTC走代理 !== true,
    'use-hosts': true,
    'cache-algorithm': 'arc',
    'prefer-h3': false, // 冷启动跳过 DoH 的 HTTP/3 探测，避免 UDP 不通时 DNS 卡住
    'use-system-hosts': true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-range6': '2001:2::1/48',
    'fake-ip-filter': [
      'rule-set:private',
      'rule-set:fakeip_filter',
      'rule-set:geolocation-cn',
      ...(ruleOptionsEnable['FCM'] ? ['rule-set:googlefcm'] : []),
      ...proxyFakeIpFilter,
    ],
    'default-nameserver': defaultDNS,
    'proxy-server-nameserver': proxyServerDNS,
    ...(Object.keys(proxyServerPolicy).length > 0 && {
      'proxy-server-nameserver-policy': proxyServerPolicy,
    }),
    nameserver: foreignDNS,
    'nameserver-policy': {
      'rule-set:private': 'system',
      'rule-set:douyin': ['system', '180.184.1.1', '180.184.2.2'],
      'rule-set:cn': chinaDNS,
    },
    'direct-nameserver': chinaDNS,
    'direct-nameserver-follow-policy': true,
  };

  const hosts = {
    'doh.pub': ['1.12.12.12', '120.53.53.53'],
    'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
    'dns.google': ['8.8.8.8', '8.8.4.4'],

    // 解决谷歌商店无法下载的问题
    'services.googleapis.cn': 'services.googleapis.com',

    // 屏蔽哔哩哔哩PCDN，解决访问视频/直播卡顿问题
    '+.mcdn.bilivideo.com': ['0.0.0.0'],
    '+.mcdn.bilivideo.cn': ['0.0.0.0'],
    '+.edge.mountaintoys.cn': ['0.0.0.0'],
    '+.h2.smtcdns.net': ['0.0.0.0'],
  };

  return { dns, hosts, proxies: mappedProxies };
}

// --- 主入口 ---

/**
 * 主入口：覆写机场订阅配置，生成完整 mihomo 配置
 */
function main(config) {
  if (config['proxy-providers'] && Object.keys(config['proxy-providers']).length > 0) {
    throw new Error('配置文件中包含 proxy-providers，请使用机场提供的配置文件进行覆写');
  }

  // ---- 总原则：newConfig 以输入配置铺底，脚本只做"读现有、缺失才补默认" ----
  // 连接面归 App（Bettbox / Clash Verge Rev 会覆盖），分流/DNS 面归脚本。
  const newConfig = { ...config };

  const filteredProxies = filterAndNormalizeProxies(config);

  // ===== [组合脚本专属] Spark 组合池拆分 =====
  // 通用分组池只用非 Spark 节点；保留的 Spark 节点（港/新）只进专属组；
  // DNS/hosts 处理覆盖全部保留节点，保证 Spark 节点的域名解析与防死锁待遇不变。
  const comboSplit = splitComboSparkProxies(filteredProxies);
  const generalProxies = comboSplit.generalProxies;
  const comboSparkGroupsInfo = buildComboSparkGroups(comboSplit.sparkProxies);

  const { customProxies, customProxyNames, customGroup } = buildCustomizeGroups(generalProxies);

  const generatedRegionGroups = buildRegionGroups(generalProxies, customProxies);

  const { globalGroup, functionalGroups, functionalRules, finalRuleProviders, directGroup } = buildFunctionalGroups(
    generalProxies,
    generatedRegionGroups,
    { customProxyNames, customGroup, comboSparkSelectNames: comboSparkGroupsInfo.selectNames },
  );

  const { dns, hosts, proxies: mappedProxies } = buildDnsAndHostsConfig(config, comboSplit.keptProxies);

  newConfig['dns'] = dns;
  newConfig['hosts'] = hosts;

  // ============ 连接面：尊重现有，缺失才补默认 ============
  // 以下字段两家主流客户端（Bettbox / Clash Verge Rev）均会接管覆盖，
  // 脚本写入仅作兜底（软路由裸跑 / 分享场景），App 设置优先。
  // ⚠️ 判断必须用 === undefined：端口填 0 表示"明确禁用"，falsy 检查会误判并擅自启用。

  // ---- 5 端口逻辑 ----
  // 保证至少有一个入站可用；socks-port / redir-port / tproxy-port 缺失 = 不启用，绝不擅自开启。
  if (newConfig['mixed-port'] === undefined && newConfig['port'] === undefined) {
    newConfig['mixed-port'] = 7890;
  }
  // 注：socks-port、redir-port、tproxy-port 此处故意不补默认 ——
  // 多开一个监听就多一个暴露面，默认关闭是安全正确选择（与 Bettbox 默认全 0 一致）。

  if (newConfig['allow-lan'] === undefined) newConfig['allow-lan'] = true;
  // 顶层 ipv6：默认留空交 App 接管（Bettbox / CVR 均有对应设置），脚本不强制改写。
  // ⚠️ 仅当未设置 且 开关1「WebRTC走代理」开启时，由开关设为 false ——
  //   IPv6 通道可绕过代理直连，是 WebRTC 泄露真实 IP 的已知路径，必须关掉；App 已设置时尊重 App。
  //   历史教训：曾写死 ipv6:true，移动网 IPv6 直连导致 WebRTC 泄露。
  // 【已知缺口】App 里若已是 ipv6:true，脚本不会关（见「IPv6总开关」注释）。
  if (newConfig['ipv6'] === undefined && ruleOptionsEnable.WebRTC走代理) {
    newConfig['ipv6'] = false;
  }
  if (newConfig['mode'] === undefined) newConfig['mode'] = 'rule';
  if (newConfig['log-level'] === undefined) newConfig['log-level'] = 'info';
  if (newConfig['bind-address'] === undefined) newConfig['bind-address'] = '*';
  if (newConfig['unified-delay'] === undefined) newConfig['unified-delay'] = true;
  if (newConfig['tcp-concurrent'] === undefined) newConfig['tcp-concurrent'] = true;
  if (newConfig['keep-alive-interval'] === undefined) newConfig['keep-alive-interval'] = 60;
  if (newConfig['find-process-mode'] === undefined) newConfig['find-process-mode'] = 'strict';

  // external-controller：不写，不补默认。
  // Bettbox 默认将其置空禁用，写入会被 App patch 覆盖；如需 Dashboard 请在 App 设置中手动开启。
  // 经 {...config} 铺底，用户自带的 external-controller / secret 会被原样透传保留。
  if (newConfig['external-ui'] === undefined) newConfig['external-ui'] = 'ui';
  if (newConfig['external-ui-url'] === undefined) {
    newConfig['external-ui-url'] = 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip';
  }

  // ---- TUN：尊重现有（软路由裸跑时兜底，Bettbox/CVR 用户由 App 接管） ----
  if (newConfig['tun'] === undefined) newConfig['tun'] = {};
  const tunCfg = newConfig['tun'];
  if (tunCfg['enable'] === undefined) tunCfg['enable'] = true;
  // ⚠️ 不设 stack 默认值：mips 在 Windows 上不可用会导致 TUN 起不来（2026-10-16 实测断网）；
  // 交给 Mihomo 按平台选默认（Windows 默认 gvisor）。
  if (tunCfg['auto-route'] === undefined) tunCfg['auto-route'] = true;
  if (tunCfg['strict-route'] === undefined) tunCfg['strict-route'] = true;
  if (tunCfg['auto-redirect'] === undefined) tunCfg['auto-redirect'] = true;
  if (tunCfg['auto-detect-interface'] === undefined) tunCfg['auto-detect-interface'] = true;
  if (tunCfg['dns-hijack'] === undefined) tunCfg['dns-hijack'] = ['any:53', 'tcp://any:53'];

  // ---- NTP：尊重现有 ----
  if (newConfig['ntp'] === undefined) {
    newConfig['ntp'] = {
      enable: true,
      'write-to-system': false, // 不写系统时钟，安全起见
      server: 'ntp.aliyun.com',
      port: 123,
      interval: 60,
    };
  }

  // ============ 脚本全权：profile / geo / etag ============
  newConfig['profile'] = {
    'store-selected': true, // 记住策略组选择，重启免测速（冷启动优化）
    'store-fake-ip': true, // 持久化 fake-ip 映射，首包不等 DNS
  };
  if (newConfig['geo-auto-update'] === undefined) newConfig['geo-auto-update'] = true;
  if (newConfig['geo-update-interval'] === undefined) newConfig['geo-update-interval'] = 168;
  if (newConfig['etag-support'] === undefined) newConfig['etag-support'] = true; // 规则集 ETag 去重下载
  // ⚠️ ASN 数据库：IP-ASN 原生规则依赖此库（Claude、Financial 组的 ASN 兜底）。
  //   不配则 IP-ASN 规则无效。URL 与 geoip/geosite 保持同一源（MetaCubeX 官方）。
  if (newConfig['geox-url'] === undefined) {
    newConfig['geox-url'] = {
      geoip: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
      geosite: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
      mmdb: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.metadb',
      asn: 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb',
    };
  }

  // ============ Sniffer：开关控制，默认关闭 ============
  // ⚠️ 域名嗅探会改写部分 App 的流量目标，银行/券商类 App 对此敏感可能断连。
  // 默认关闭；Bettbox 开启"覆写 Sniffer"时 App 配置整体替换此处写入，无影响。
  if (ruleOptionsEnable.启用Sniffer配置) {
    newConfig['sniffer'] = {
      enable: true,
      'override-destination': false,
      sniffing: ['tls', 'http'],
      'force-dns-mapping': true,
      'parse-pure-ip': true,
      sniff: {
        HTTP: { ports: ['80', '8080-8880'], 'override-destination': true },
        TLS: { ports: ['443', '8443'] },
        QUIC: { ports: ['443', '8443'] },
      },
      'skip-domain': snifferFinanceSkipDomains,
    };
  }

  // ---- WebRTC走代理：为缺省 udp 的普通代理节点补 udp:true ----
  // 背景：mihomo 对缺省 udp 的节点按 udp:false 处理；STUN 走 UDP，若节点不支持 UDP，
  //   请求会 fallback 到 DIRECT 用真实 IP 发包，导致 WebRTC 泄露（2026-10-15 实测）。
  // 仅修复未声明 udp 的节点；显式 udp:false（订阅明确声明不支持）必须原样保留，不强行改写。
  // direct/reject/rematch 等伪节点不改写；不添加全局 UDP 劫持规则。
  // ⚠️ 本开关不保证每个节点都能承载 STUN：显式声明不支持 UDP 的节点仍可能导致 UDP 流量匹配后续规则。
  const webrtcProxyFixEnabled = ruleOptionsEnable.WebRTC走代理;
  newConfig['proxies'] = [...mappedProxies, ...customProxies, ...directProxies].map((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (
      !webrtcProxyFixEnabled ||
      proxy.udp !== undefined ||
      type === 'direct' ||
      type === 'reject' ||
      type === 'rematch'
    ) {
      return proxy;
    }
    return { ...proxy, udp: true };
  });
  newConfig['proxy-groups'] = [
    globalGroup,
    ...functionalGroups,
    ...(customGroup ? [customGroup] : []),
    directGroup,
    ...generatedRegionGroups,
    ...comboSparkGroupsInfo.groups, // [组合脚本专属] Spark 专属组（港/新）
  ];
  newConfig['rule-providers'] = finalRuleProviders;

  newConfig['rules'] = [
    // 主防线段已并入此前缀（private 之后、geolocation-cn 之前），见 buildDefensePrefixRules。
    ...buildDefensePrefixRules(),
    // 开关2「屏蔽STUN端口」：直接拦截常见 STUN/TURN 端口，优先级高于开关1；位置在 QUIC 屏蔽之前。
    ...(ruleOptionsEnable.屏蔽STUN端口 ? [...privateStunDirectRules, ...blockStunPorts] : []),
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,

    // 兜底规则
    'RULE-SET,cn,直连',
    'RULE-SET,geolocation-!cn,默认代理',
    'RULE-SET,cn_ip,直连',
    'RULE-SET,private_ip,直连',
    'MATCH,漏网之鱼',
  ];

  return newConfig;
}
