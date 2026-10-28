# WP-8 规则优先级、规则集与健康检查专题

- 范围：Go 主版 `Script/mihomoScriptGo.js`（目标仓 @cc46de0，文件 sha256 前缀 `8a2cef4a7887`）的规则生成顺序、Rule Provider 健康矩阵、组健康检查参数；上游对照为 AIsouler/MyClash `Script/mihomoScript.js`（@071d4ec）。smart/combo 两版的 rules 组装段与 Go 主版逐字一致（E2 直读验证），差异仅在组类型与成员构成，不在本文件重复展开。
- 证据等级：E4=本次实测/直读源码并运行；E2=官方文档或源码直读；E1=单次探活/通行实现观察。**单次探活不构成长期可靠性结论**，可靠性分级依据为：源仓库维护状态（API 直查）、分发通道历史事件（项目巡检记录）、冷启动兜底实测三者的组合判断。
- 实验与引用完整性实测见同目录 `group_reference_integrity.md`（EXP-WP8-01）。

---

## 1. 匹配模型（官方语义，E2）

- mihomo 规则**自上而下顺序匹配，首个命中即终止**（wiki 路由规则页，SRC-801）。因此脚本的规则数组顺序即优先级设计本身。
- IP 类规则（IP-CIDR/IP-ASN/RULE-SET-ipcidr 等）在域名流量上默认会**触发一次 DNS 解析**以取得目标 IP 再匹配；加 `no-resolve` 则跳过本次触发；若更早的规则已触发解析，`no-resolve` 规则仍可基于已解析结果命中（SRC-801）。在 fake-ip 模式下域名流量天然携带映射 IP，此副作用主要影响 redir-host 场景与纯 IP 流量。
- 规则引用不存在的 rule-provider、或 provider 内容为空集时，该 RULE-SET 规则**永不命中**，流量继续向下匹配——即 provider 故障的失效方向是「分流精度下降、落入后续规则/兜底」，不是整体断网（实现通行行为，E1；官方文档未明示首次下载失败语义，列为未决项 U-1）。

## 2. Go 主版规则生成顺序全表

默认开关下输出共 **96 条**（合成输入实测，EXP-WP8-01/S1）：前缀 11 + QUIC 屏蔽 1 + 服务规则 79 + 兜底 5。STUN 屏蔽段默认关（开启时 +11 条，插入位置见 §2.2）。组装代码：`main()` L1972-1985、`buildServiceRules()` L1290、`prefixRules` L124。

### 2.1 第一段：prefixRules（L124-141，恒定 11 条）

| # | 规则 | 目标 | 顺序理由 |
|---|---|---|---|
| 1 | `DOMAIN,cdn.jsdmirror.com` | 直连 | 规则集/图标下载域名先行直连，打断「规则未加载→无法下载规则」的引导循环 |
| 2 | `DOMAIN,raw.githubusercontent.com` | 直连 | 同上；2026-10-27 规则集主源切换到 raw 后新增（上游无此条） |
| 3 | `RULE-SET,private` | 直连 | 私有/保留域名在一切服务规则之前直连，防止内网域名被服务规则集截获 |
| 4 | `RULE-SET,geolocation-cn` | 直连 | 国内域名总表前置：先于服务组命中，保证国内版服务（如国内版 AI/微软中国）不进代理组 |
| 5 | `RULE-SET,games_cn` | 直连 | 游戏国内服（含 Steam 下载域名）直连 |
| 6 | `RULE-SET,nvidia_cn` | 直连 | NVIDIA 国内域名直连（与 AI 组的手写 nvidia.com 国际域名互补不重叠） |
| 7 | `RULE-SET,apple_cn` | 直连 | Apple 中国服务直连，先于 Apple 组（代理向）命中 |
| 8 | `RULE-SET,microsoft_cn` | 直连 | 同上，先于 Microsoft 组 |
| 9 | `DOMAIN,fsend.cn` | 直连 | 单域名补漏 |
| 10 | `DOMAIN,international-gfe.download.nvidia.com` | 直连 | 驱动下载 CDN 直连，与第 6 条双保险 |
| 11 | `DOMAIN-SUFFIX,ctaiot.com` | 直连 | 中国电信物联网（2026-10-21 借鉴上游补充） |

注：第 4 条与兜底段的 `RULE-SET,cn,直连` 是两道不同的国内防线：geolocation-cn 在**最前**（先于所有服务组），cn 在**最后**（服务组之后、geolocation-!cn 之前）——前者保证「国内优先」，后者是 2026 年为小红书等国内 App 补的「服务规则集误收国内域名」的事后拦截。两者间夹着全部服务规则，是有意的三明治结构。

### 2.2 第二段：条件注入的拦截规则（默认仅 QUIC 段）

| 条件 | 规则 | 说明 |
|---|---|---|
| 屏蔽STUN端口=开（默认关） | `privateStunDirectRules` 5 条 AND 规则：`(NETWORK,UDP/TCP)×(DST-PORT 3478/5349/19302-19309) ∧ RULE-SET,private_ip,no-resolve → 直连` | 内网同端口例外，**必须排在拒绝规则前**，避免误伤内网语音/会议服务；子规则带 no-resolve（SRC-801 语义下此处为纯 IP 匹配，不触发解析） |
| 同上 | `blockStunPorts` 5 条 AND 规则 → REJECT + 19302-19309 段 1 条（UDP） | 只拦列出端口，不拦全部 UDP；TURN over TCP 443 不拦（代码注释明示边界） |
| 屏蔽国外QUIC=开（默认开） | `AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT` | 国外 UDP/443（QUIC）拒绝，迫使回落 TCP；例外子句：命中 cn_additional（域名集）或 cn_ip（带 no-resolve）的国内目标豁免。失效方向分析：若 cn_additional 加载失败为空集，豁免收窄 → 国内 QUIC 被误拦面扩大（可用性降级，不构成泄漏）；若 cn_ip 为空集同理 |

### 2.3 第三段：服务规则（buildServiceRules，79 条）

排序规则：**AdBlock 被显式提到最前**（`buildServiceRules` L1290 先 filter AdBlock），其余严格按 `serviceConfigs` 定义顺序（L460 起）。设计意图：广告域名在任何服务归属判断之前先被 REJECT 类组接管，避免被服务规则集（如 youtube/google）先行认领。

| 序 | 组 | 条数 | 规则构成（→目标组） | no-resolve 条目 |
|---|---|---|---|---|
| 1 | AdBlock | 1 | `RULE-SET,avenue-ads` | — |
| 2 | FCM | 1 | `RULE-SET,googlefcm` | — |
| 3 | YouTube | 1 | `RULE-SET,youtube` | — |
| 4 | Google | 2 | `RULE-SET,google`（域名）、`RULE-SET,google_ip`（IP） | `google_ip` ✔ |
| 5 | Claude | 6 | 手写 `DOMAIN-SUFFIX` ×4（anthropic.com/claude.ai/claude.com/claudeusercontent.com）→ `RULE-SET,anthropic` → `IP-ASN,399358` | `IP-ASN,399358` ✔ |
| 6 | AI | 9 | 手写 ×8（auth0.com、qwen.ai、dashscope-intl.aliyuncs.com、z.ai、build/nvcf/ngc.nvidia.com、integrate.api.nvidia.com）→ `RULE-SET,ai`（category-ai-!cn） | —（全域名规则） |
| 7 | GitHub | 1 | `RULE-SET,github` | — |
| 8 | Microsoft | 2 | `RULE-SET,microsoft`、`RULE-SET,microsoft_ip` | `microsoft_ip` ✔ |
| 9 | Apple | 2 | `RULE-SET,apple`、`RULE-SET,apple_ip` | `apple_ip` ✔ |
| 10 | Telegram | 2 | `RULE-SET,telegram`、`RULE-SET,telegram_ip` | `telegram_ip` ✔ |
| 11 | TikTok | 2 | `RULE-SET,tiktok`、`RULE-SET,tiktok_ip` | `tiktok_ip` ✔ |
| 12 | Twitter | 2 | `RULE-SET,twitter`、`RULE-SET,twitter_ip` | `twitter_ip` ✔ |
| 13 | Meta | 2 | `RULE-SET,meta`、`RULE-SET,facebook_ip` | `facebook_ip` ✔ |
| 14 | Emby | 12 | `RULE-SET,emby`、`RULE-SET,emos`、手写 DOMAIN-SUFFIX ×2、DOMAIN-KEYWORD ×1、PROCESS-NAME ×7 | —（含进程规则，仅桌面/安卓包名场景有效） |
| 15 | PikPak | 1 | `RULE-SET,pikpak` | — |
| 16 | Financial | 31 | `DOMAIN-SUFFIX,laohu8.com→DIRECT`（组内第一条，防国内版虎app被金融规则误收）→ `RULE-SET,cryptocurrency` → IBKR 域名 ×6 + `IP-ASN` ×4（27163/33121/40711/9468）→ MT5 域名 ×7 → TradingView ×1 → Firstrade 域名 ×1 + `IP-ASN,32699` → Mitrade ×3 → 虎国际 ×6 | 全部 5 条 `IP-ASN` ✔ |
| 17 | Cloudflare | 2 | `RULE-SET,cn_ip→直连`（**无 no-resolve**，CF 中国 IP 先直连）→ `RULE-SET,cloudflare→Cloudflare`（no-resolve ✔） | `cloudflare` ✔ |

**no-resolve 使用规律（E2/E4）**：服务组的 IP 类规则（geoip RULE-SET 与 IP-ASN）**全部**带 no-resolve，共 12 条 + 逻辑规则内的 cn_ip/private_ip 子规则；域名类规则一律不带（带了无意义）。两处例外值得记录：
- Cloudflare 组首条 `RULE-SET,cn_ip,直连` 与兜底段的 `RULE-SET,cn_ip,直连`、`RULE-SET,private_ip,直连` **未带 no-resolve**。由于它们位于规则链尾部，此前任何 IP 类规则或 fake-ip 映射通常已使目标 IP 可得，实际影响小；但在 redir-host + 纯域名流量且前面全部未触发解析的路径上，这三条会触发一次解析。与同文件其他 IP 规则的写法不一致，属可统一的风格项（非缺陷判定，列建议 S-1）。
- Claude/Financial 的 IP-ASN 依赖 `geox-url.asn`（GeoLite2-ASN.mmdb，MetaCubeX 源）；脚本在 geox-url 缺失时整段补默认（main L1913 起），ASN 规则才有数据基础。

### 2.4 第四段：兜底 5 条（main L1979-1984）

| # | 规则 | 命中逻辑 |
|---|---|---|
| 1 | `RULE-SET,cn,直连` | 服务规则之后再拦一道国内域名（见 §2.1 注） |
| 2 | `RULE-SET,geolocation-!cn,默认代理` | 已知国外域名总表 → 默认代理，是 MATCH 之前的主要国外通道 |
| 3 | `RULE-SET,cn_ip,直连`（无 no-resolve） | 纯 IP 流量的国内段直连 |
| 4 | `RULE-SET,private_ip,直连`（无 no-resolve） | 纯 IP 流量的私有段直连（与第 1 段 private 域名集互补） |
| 5 | `MATCH,漏网之鱼` | 其余全部进入「漏网之鱼」组（成员：默认代理/直连/地区手动组），用户可人工裁决 |

### 2.5 与上游同段对比（E2）

| 维度 | 上游 MyClash（@071d4ec） | Go 主版 | 影响 |
|---|---|---|---|
| 前缀规则 | 10 条（无 raw.githubusercontent 直连） | 11 条 | 与规则集主源选择配套（上游走 jsdmirror、Go 走 raw） |
| STUN 屏蔽段 | 无（WebRTC 防护为节点 udp 处理，无端口拦截段） | 有（双开关之开关 2，默认关） | Go 线新增能力 |
| 服务规则排序 | 同为 AdBlock 先行 + 定义顺序 | 相同 | 排序框架同源 |
| AdBlock 规则集 | `category-ads`（bett-rules geosite） | `avenue-ads`（AWAvenue 完整版，jsDelivr） | 拦截强度与供应链均不同（见 §3） |
| AI 分组 | AI 单组（category-ai-!cn） | Claude 独立组排在 AI 之前 + ASN 兜底 | 靠顺序防截胡，是顺序敏感设计 |
| Financial | Crypto 组（规则集为主） | 合并组：规则集 + 31 条手写（域名/ASN） | 手写规则占比显著上升，维护责任转移到本项目 |
| Cloudflare 组 | 无 | 有，且在服务段最末（只接未认领的 CF IP 流量） | 位置即语义：专属组优先、本组殿后 |
| 兜底段 | 4 条：geolocation-!cn、cn_ip、private_ip、MATCH（极简模式时 MATCH→默认代理） | 5 条：多了最前的 `RULE-SET,cn,直连` | Go 线针对国内 App 被代理拒连的实测问题加固 |
| 组公共参数 | interval 600 / apple URL / empty-fallback REJECT / tolerance 50（url-test） | **完全相同** | 健康检查体系同源未改（见 §4） |

## 3. 规则集源健康矩阵

默认全开时共 **38 个 provider**，全部 `type: http、format: mrs、interval: 86400`（`ruleProviderCommonDomain/Ipcidr`，L286-297）。按分发通道分四组：

### 3.1 bett-rules via raw.githubusercontent（34 个，占 89%）

- 成员：base 段 bett 系 12 个（private、private_ip、games_cn、nvidia_cn、apple_cn、microsoft_cn、geolocation-cn、cn_ip、geolocation-!cn、cn、fakeip_filter、douyin；base 段另有 cn_additional 属 §3.4）与服务组 22 个（googlefcm、youtube、google、google_ip、anthropic、ai、github、microsoft、microsoft_ip、apple、apple_ip、telegram、telegram_ip、tiktok、tiktok_ip、twitter、twitter_ip、meta、facebook_ip、pikpak、cryptocurrency、cloudflare），合计 34。
- 所有者/维护：appshubcc/bett-rules，`meta` 分支每日自动发布；最近提交 2026-10-27T01:39Z「Released on 2026-10-27」（GitHub API 直查，SRC-806）。
- 通道历史：原 jsdmirror 通道曾有分钟级 403 抖动（项目巡检 2026-10-27 记录）；jsDelivr 通道因该仓包体超 50MB 上限被实证拒绝（403 响应体明示）；2026-10-27 已切换 raw 官方源（SRC-814）。
- 冷启动兜底：34 个中 **30 个**的 `path-in-bundle` 在当前 BundleMRS.7z（meta-rules-dat release @02ae05ac）中实存（EXP-WP8-02 实测）；缺失 4 个：fakeip_filter、microsoft_ip、apple_ip、tiktok_ip。
- 失败影响：面最大——该源整体失效则国内直连防线（private/geolocation-cn/cn/cn_ip）与多数服务分流同时降级为空集，流量涌向兜底（geolocation-!cn 本身也属该源，一并失效时最终落 MATCH→漏网之鱼→默认代理，即「全量走代理」的降级形态，不会断网但国内直连全失）。
- 替代源：bett-rules 亦可经 jsdmirror 镜像（历史抖动）或自建镜像；内容同源于 v2fly/domain-list-community 与 MetaCubeX geo 数据，可用 meta-rules-dat 的同名 mrs 直接替换大部分（bundle 内容即此来源）。
- **可靠性分级：A-**（维护活跃、官方通道、无中间镜像层；扣分项：单仓库单通道集中度 89%、分支引用为可变分支 `meta` 而非 commit 固定、4 个 bundle 路径缺失）。

### 3.2 AWAvenue-Ads-Rule via jsDelivr（1 个：avenue-ads）

- 所有者/维护：TG-Twilight/AWAvenue-Ads-Rule，`main` 分支；最近提交 2026-10-26（SRC-807），维护活跃。
- 通道风险：jsDelivr 对超限仓库有 50MB 拒绝的已实证先例（对象为 bett-rules）；AWAvenue 仓体积小、当前不在此风险内，但通道层规则对所有仓一视同仁。引用为 `@main` 可变分支。
- 冷启动兜底：`path-in-bundle: geo/geosite/avenue-ads.mrs` 在 BundleMRS.7z 中**不存在**（EXP-WP8-02 实测）——bundle 兜底对此 provider 无效，冷启动完全依赖首次下载成功；失败时 AdBlock 空集 → 广告域名继续向下走服务规则/兜底（失效方向温和）。
- 替代源：同仓可经 raw 或 jsdmirror 取同一文件；或回退 bett-rules category-ads（上游方案，拦截面较小）。
- **可靠性分级：B**（源活跃、失效影响局限于广告拦截；扣分：jsDelivr 通道政策风险 + bundle 兜底失效 + 可变分支）。

### 3.3 Emby/emos via jsdmirror（2 个）

- 成员：emby（666OS/rules `release` 分支，最近提交 2026-10-25，SRC-808）、emos（binaryu/emos-proxy-rule `main`，最近提交 2026-10-26，SRC-809）。两源本身均活跃。
- 通道风险：jsdmirror 为国内公益镜像，项目巡检曾记录分钟级 403 抖动（SRC-814）；两 provider 是全表仅剩的 jsdmirror 依赖（图标基址亦同通道，但图标失败不影响流量）。
- 冷启动兜底语义偏差：两者的 `path-in-bundle` 均为 `geo/geosite/category-emby.mrs`（包内实存）——即冷启动兜底加载的是 **meta-rules-dat 的 category-emby 内容，而非 666OS/emos 的原文**。emos 本是独立维护的 Emby 兼容集，与 category-emby 内容不保证等价；兜底只在「本地无缓存且客户端带 bundle」时生效，属隐性语义替换，建议在注释中显式声明（建议 S-2）。
- 替代源：两仓均可经 jsDelivr/raw 直连（666OS 的 Emby.mrs 曾用 fastly.jsdelivr 地址，见 WP-1 dependency_inventory 的 archive 记录）。
- **可靠性分级：B-**（源活跃但通道有实测抖动记录、兜底内容不等价；失效影响局限于 Emby 分流）。

### 3.4 cn_additional via 个人域名静态托管（1 个）

- URL：`https://static-file-global.353355.xyz/rules/cn-additional-list.mrs`；无公开仓库/版本记录可查（来源不透明度为全表最高，E1）。
- 用途单一：仅在 QUIC 屏蔽的 NOT 例外子句中被引用；且「屏蔽国外QUIC」关时 provider 与规则一并移除（buildRuleProviders L1311-1313，EXP-WP8-01/S6 间接验证其门控逻辑）。
- 失败影响：provider 空集 → QUIC 豁免收窄（见 §2.2），方向为过度拦截国内 QUIC；不影响其他任何规则。
- 替代源：可用 bett-rules 的 cn/geolocation-cn 域名集近似替代豁免名单（语义不完全等价，该名单为项目自攒的补充集）。
- **可靠性分级：C**（单一个人域名、无版本锚点、无兜底；靠「用途边缘化」控制爆炸半径——这是全表风险处置最合理的一处：最不可靠的源只承担最不重要的职责）。

### 3.5 格式与参数共性（E2）

- 全表统一 mrs：二进制 trie 格式，加载快、体积小；mrs 仅支持 domain/ipcidr 两种 behavior（wiki，SRC-802），与本表使用方式一致。无 classical/yaml/text 混用，避免了格式-behavior 错配类故障。
- `interval: 86400`（24h）对全部 provider 一刀切：规则集上游多为每日发布，节奏匹配；但意味着源端紧急修正最坏需 24h 才到达用户（etag-support 已开，可减少无变更时的重复下载）。
- `path` 全部显式写 `./ruleset/*.mrs` 且互不重复，满足 wiki「path 不可重复」要求（SRC-802）；`path-in-bundle` 使带 BundleMRS 的客户端具备冷启动兜底（本次实测覆盖率 33/38，见 EXP-WP8-02）。
- 代码气味（E2，非缺陷）：`baseRuleProviders` 中 `cn` 键被定义了两次（L366 与 L387，内容完全相同），JS 对象字面量后者覆盖前者、行为无差异；且 `buildRuleProviders` 用 `{...base}` + `Object.assign` 叠加服务 providers，同名键会静默覆盖——当前服务段与 base 段无同名键（EXP-WP8-01 输出 38 键与源码定义逐一对齐），属潜在风险而非现行问题，建议 WP-14 加一条「provider 键唯一性」静态检查。
- 更新失败行为（E1，未决项 U-1）：官方文档未明示；按实现通行行为，更新失败保留本地旧文件继续用（陈旧而非空集），冷启动无缓存则为空集。建议 WP-14 用故障注入升级为 E4。

### 3.6 即时探活（E1 补充，不构成可靠性结论）

2026-10-28 01:00 CST（2026-10-27 17:00 UTC），自本研究沙箱（境外出口）对 38 个 provider URL + 健康检查 URL 做 Range GET：**39/39 全部 HTTP 206**，耗时 0.26-1.69s。仅证明该时刻、该出口下文件存在且可达；与 2026-10-27 巡检的「69/69 全活」互为旁证，但两者都是点测，长期可靠性仍以 §3.1-3.4 的结构因素为准。

## 4. 健康检查 URL 与组参数分析

### 4.1 清点（E2/E4，groupBaseOption L402-411 及派生）

全表所有组共用一套参数（`groupBaseOption`），三件套一致，上游同源未改：

| 参数 | 值 | 适用 |
|---|---|---|
| url | `https://www.apple.com/library/test/success.html` | 全部组（含 select 组——仅用于面板延迟显示，不触发切换） |
| interval | 600s | 全部组 |
| timeout | 3000ms | 全部组 |
| lazy | true | 未被选中的组不测速（wiki：默认即 true，SRC-803） |
| max-failed-times | 3（wiki 默认 5） | 失败达阈值触发一次强制健康检查 |
| empty-fallback | `REJECT` | 组为空时的回退（wiki：仅支持 proxy 名、不支持组名；REJECT 为内置 proxy 名，合规，SRC-803） |
| tolerance | 50ms（仅 url-test 系：Auto/地区-Auto/Eco-Auto） | 延迟差小于 50ms 不换节点，抑制抖动跳变 |
| expected-status | 未设置（wiki 默认 `*`，任意状态码算存活） | 全部组 |
| strategy | `sticky-sessions`（仅负载均衡组） | 同源会话粘性 |

组类型构成（S1 实测）：select 25+（含地区手动组随地区数浮动）、url-test 为 Auto + 各地区 Auto/Eco-Auto、load-balance 1（负载均衡）、smart 版另有 smart 型地区组（WP-10 范围）。

### 4.2 讨论

- **为什么是 Apple 而不是 generate_204**：apple.com 的 test/success.html 是 Apple 官方的连通性测试页（ captive portal 检测同款），全球 Anycast、体积小、无内容争议；且 Apple 域名在本配置中走直连/Apple 组均可达，不存在「测速目标本身被墙导致全员误判」的风险——这正是国内环境弃用 gstatic 的通行理由（gstatic 在国内直连不可达，但经节点测速本可达；真正的差异在于 Apple 页对**直连成员**（直连组、FCM 默认直连等）同样可测，而 gstatic 对直连成员永远超时。本配置的组里普遍含直连选项，Apple 是能让直连与代理成员同尺比较的少数选择。此为结构推论，E2）。
- **地理因素**：测的是「节点 → Apple Anycast 最近边缘」的延迟，反映节点出口质量与骨干网状况，不等于到目标服务（GitHub/AI 服务）的延迟；地区内排序可信，跨服务推断不可靠。url-test 的实际用途是组内选优，此近似可接受。
- **隐私**：健康检查经每个被测节点向 apple.com 发起 TLS 连接，节点运营方可见「有测速流量经过」但不见用户真实流量内容与目标；600s 间隔 + lazy 使未选中组的节点零测速流量。测速不携带用户标识信息。风险低（E2 推论）。
- **误判面**：①expected-status 未设 → 返回任意 HTTP 状态（如节点出口被劫持到错误页、403 页）也算「活」，url-test 可能选中一个能连 Apple 但业务不可用的节点；②timeout 3000ms 对跨洋高延迟节点偏紧，慢而可用者排名吃亏（只影响排序与 max-failed-times 触发频率，不剔除成员）；③单一测速目标 = 单点：apple 测速端点异常时全组同时「假死」，max-failed-times=3 会放大强制复检频率。建议 S-3：评估为 url-test 组补 `expected-status: 200`（success.html 正常应答为 200）以消除劫持型假活——属行为变更建议，需用户拍板，不在本 WP 实施。
- **fallback 型组**：本配置**没有使用 fallback 组类型**（仅 select/url-test/load-balance/smart），故「主备切换」语义由 url-test 的实时选优替代；empty-fallback=REJECT 承担的是「组被过滤成空集时明确拒绝而非静默直连」的安全语义，与 EXP-WP8-01 的空组实测互证（正常输入下无空组产生，该参数是防御性兜底）。

## 5. 规则集失效与冷启动测试用例（交付 WP-14 引用）

| 用例 ID | 场景 | 方法 | 预期可观察结果 |
|---|---|---|---|
| TC-WP8-01 | 单 provider 404（模拟 avenue-ads 改名） | 本地 HTTP 桩对指定 URL 返回 404，冷启动加载 | AdBlock 空集；其余分流正常；广告域名落入后续规则 |
| TC-WP8-02 | bett-rules 整源不可达 | 桩对 raw 域名黑洞 | 国内直连防线失效、流量落默认代理；不出现加载硬错误 |
| TC-WP8-03 | provider 返回损坏 mrs | 桩返回随机字节 | 该 provider 空集处理；日志有加载错误；其余 provider 不受影响 |
| TC-WP8-04 | 冷启动 + bundle 在场 | 清缓存、保留 BundleMRS.7z、断网首启 | 33 个有 bundle 路径的 provider 以包内版本生效；5 个缺失者（fakeip_filter/microsoft_ip/apple_ip/tiktok_ip/avenue-ads）为空集 |
| TC-WP8-05 | cn_additional 单独失效 | 桩黑洞 353355.xyz | QUIC 豁免收窄；国内 QUIC 站点被拦面扩大；其余无变化 |
| TC-WP8-06 | 更新期陈旧缓存 | 预置旧版缓存文件 + 源端发布新版 | interval 到期前用旧版；到期后 etag/全量更新 |

## 6. 未决项与建议

- U-1：provider 首次下载失败/更新失败的官方语义无文档明示（E1 推论待 WP-14 故障注入实测升级）。
- U-2：Bettbox 客户端是否随包携带 BundleMRS.7z 未核实——若不带，§3 的 bundle 兜底分析仅适用于带 bundle 的客户端（如部分桌面端），手机端冷启动完全依赖网络下载。建议 WP-10 补充核实。
- S-1（风格统一）：兜底段与 Cloudflare 组的 3 条 IP 类 RULE-SET 补 no-resolve，与全表其他 IP 规则对齐。
- S-2（注释披露）：emby/emos 的 path-in-bundle 内容不等价问题在代码注释中显式声明。
- S-3（行为建议，需拍板）：url-test 组评估增加 expected-status: 200。
