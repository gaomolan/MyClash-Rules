# 技术发现汇编（TECHNICAL_FINDINGS）

- 日期：2026-10-28｜基线：目标仓 @ `cc46de0`、上游 @ `071d4ec`、官方内核 v1.19.33
- 口径：每条发现标注证据等级与文件出处。**E4 均为配置生成级实测**（在 JS 沙箱运行 `main()` 校验生成物），不证明内核运行时行为；凡运行时结论均单独标注为推论或未验证。本文件只汇编已有发现，不新增结论；修复建议属各专题原文的研究建议，不代表已决定实施。

---

## 1. 基线与漂移

| # | 发现 | 证据 | 出处 |
|---|---|---|---|
| 1.1 | 目标仓 122 文件中 96 个（79%）与上游逐字节相同；自有资产仅 Script 七件 + 2 个自有 workflow + 巡检工具；仓库本质是「上游镜像 + 自有脚本线」双层结构 | E4（双克隆逐文件比对） | 01-baseline/upstream_diff_report.md |
| 1.2 | Go 线与上游共享 18 个同名函数中的 17 个（diff 约 867 行），分叉点在 `main()`：上游 `{}` 从零构建 + 无条件赋连接面默认；Go 线 `{...config}` 铺底 + 逐项 `=== undefined` 补默认。「读现有值」哲学仅存于 Go 线 | E4/E2 | 01-baseline/current_behavior_catalog.md |
| 1.3 | custom 线 = 注释 + 上游原文 + customPatch 拼接，零代码漂移；其 Validate 只查 2 个标志串，而 customPatch 实际耦合上游 4 个内部标识符（标识符改名即静默失效或抛错） | E3/E4 | 01-baseline/；04-security-licensing/threat_model.md（T-04） |
| 1.4 | 三件套派生纪律：smart 差 Go 主版 58 行、combo 差 144 行；开关数 Go 36 / combo 36（36 键及默认值逐一相同）/ smart 41（增补恰为已知 5 个 Smart 开关，共享默认值零漂移）；无 Spark 输入时 combo 组名集合与 Go 相同（退化等价成立） | E4（原型实跑 EXP-WP14-02，A1–A5 全过） | 07-validation/prototypes/check_variant_consistency.js |
| 1.5 | 仓库自带 Test 已失效：指向已归档的 Script.js/mihomoScript.js，上游克隆 188 项全过、目标仓启动即 ENOENT 崩溃；format_and_test 触发分支（main）与工作分支（myclash-rules）不符；三件套从未被该 CI 测过 | E4 | 01-baseline/；R-001 |
| 1.6 | AGENT.md（159KB）为上游旧快照，与仓库现状双向脱节（既含已删内容、又缺现行三件套） | E4 | 01-baseline/repository_inventory.csv |
| 1.7 | 开关门禁语义经 2026-10-20 事故后加固为两分：分流组类「缺失=开，仅 `=== false` 跳过」、默认关型「缺失=关」；关组场景下组/规则/provider 三联动同步消失经实测成立（见 §4.2） | E4 | 01-baseline/current_behavior_catalog.md；03-technical-research/group_reference_integrity.md |

## 2. DNS 与解析链路（WP-6，03-technical-research/dns_fakeip.md）

| # | 发现 | 证据 |
|---|---|---|
| 2.1 | 全线强制 fake-ip（恒写 16 键），不提供 redir-host 选项；fake-ip-filter 例外由 private/fakeip_filter/geolocation-cn 三个规则集承担 | E4 生成级（EXP-DNS-09） |
| 2.2 | **F11：国外解析单链无兜底**——无 fallback、无 respect-rules，两条 DoH（cloudflare-dns.com / dns.google）以 `#默认代理` 后缀出站；默认代理组无可用节点时国外解析整体中断，国内链（cn policy + direct-nameserver）独立存活。脚本内无自动缓解 | E4（字段实测）+ E2（官方流程）；运行时形态未验证（U-DNS-4） |
| 2.3 | DNS 段全权替换：输入 nameserver-policy 仅「与节点域名相交」的条目被打捞进 psn-policy，其余静默丢弃；被打捞条目的 `#组名` 后缀被剥离、私有解析一律改直连（静默改写，用户不可见） | E4（EXP-DNS-10/10B） |
| 2.4 | 输入 hosts 从不进入输出（输出恒为脚本固定表），只在特定条件下作节点 server 改写的数据源（链式映射实测生效） | E4（EXP-DNS-11） |
| 2.5 | 引导链构造免疫两处官方硬错误：恒写 psn 使「respect-rules 且 psn 为空报错」不触发；default-nameserver 两条均为 IP 形式使「填域名」风险消除 | E4/E2 |
| 2.6 | 与官方默认的显式偏离：cache-algorithm=arc（默认 lru，无选择依据记录）；fake-ip-range=198.18.0.1/15（内建默认 /16，地址池 2 倍）；direct-nameserver-follow-policy=true（默认 false）；fake-ip-range6 显式补齐（内建无默认） | E4/E3 |
| 2.7 | direct-nameserver 为两条明文 UDP（119.29.29.29 / 114.114.114.114），构成竞速投毒面（T-05）；国外链因全程加密 DoH 无此面 | E3 |
| 2.8 | `baseRuleProviders` 中 `cn` 键重复定义（L366 带引号 / L387 不带引号，JS 同一键），内容逐字相同、后者静默覆盖——当前无行为差异，属编辑陷阱（改第一处不生效） | E2 源码直读（WP-6 §2.3 附带发现，WP-8 交叉） |
| 2.9 | `commonDnsRegex` 为无锚点子串匹配：私有 DNS 域名恰含公共 DNS 子串（如 doh.pub.example.test）会被误判为公共 DNS 而剔除，等级低 | E2 |
| 2.10 | 健康检查 URL 决策-代码漂移（ISSUE-002）：2026-10-16 决策为 cp.cloudflare.com/generate_204，现行代码实际为 apple.com（Go 主版 L405）；WP-8 补充结构理由——全组共用同一测活地址且含直连成员时，测活地址须「同尺可测」，选 Apple 有结构依据；统一口径待所有者二选一 | E4（代码实测） |

## 3. IPv6 / UDP / WebRTC / QUIC（WP-7，03-technical-research/ipv6_udp_webrtc_quic.md）

| # | 发现 | 证据 |
|---|---|---|
| 3.1 | **开关 1「WebRTC 走代理」不生成任何路由规则**（纠正早期底稿假设）：其实质为三件套——输入未设时写顶层 ipv6=false、dns.ipv6 与逻辑压制、对缺省 udp 节点补 true。STUN 流量走普通规则链，最终落点 `MATCH,漏网之鱼` 是用户可在客户端切换的组，出口不由脚本锁定 | E4（EXP-WRTC-01/02 + 四组合真值表） |
| 3.2 | 双开关生成层面零相互干扰：开关 2 开启恒 +10 条规则（5 条 private 例外 + 5 条 REJECT）、位置恒在 prefixRules 之后；开关 1 的 udp 补写与 ipv6 写入独立生效 | E4（四组合实测） |
| 3.3 | IPv6 双层 12 组合矩阵实测：顶层输出只由「输入值 + 开关 1」决定、dns.ipv6 只由「总开关 && !开关1」决定，两层互不感知；输入 ipv6=true 时开关 1 关不掉顶层（缺口在生成级复现，只能靠 Bettbox App 层兜底）；脚本自身可产出「解析开、流量关」组合（输入 false + 总开关开 + 开关 1 关） | E4（EXP-DNS-07C） |
| 3.4 | udp 补写保留矩阵：缺省→补 true；显式 false/true 恒保留；direct 变体由类型守卫跳过。推论：显式 udp:false 的节点仍不承载 UDP，「STUN 必走代理」在原理上不可由脚本保证 | E4（保留矩阵）；运行时回退行为未验证（U-W7-5） |
| 3.5 | **QUIC 与 STUN 私有例外不对称**：STUN 段有 5 条 private_ip 例外先行，QUIC 规则（UDP/443 REJECT）没有——指向私有 IP 的 UDP/443 在规则序上先于兜底直连命中 REJECT，内网 HTTP/3 有误伤面 | E2（规则序推导）；运行时命中未验证（U-W7-3） |
| 3.6 | QUIC 开关关闭时规则与 cn_additional provider 同步消失（38→37），无悬空引用 | E4（EXP-QUIC-01） |
| 3.7 | 覆盖边界（不得放大引用）：端口清单只能覆盖「以常见端口（3478/5349/19302-19309）联系已知 STUN/TURN 服务器」一段；TURN over TCP/TLS 443 被刻意放行、19302-19309 的 TCP 不拦、媒体面动态端口与应用自带中继原理上覆盖不了 | E2（协议事实） |
| 3.8 | 脚本自身 DoH 恒 prefer-h3=false，不存在「QUIC 拦截自伤自身 DNS」的风险面；该风险只对用户自设 H3 DoH 成立 | E4/E2 |

## 4. 规则、代理组与规则集（WP-8）

| # | 发现 | 证据 | 出处 |
|---|---|---|---|
| 4.1 | 引用完整性全绿：7 场景 × 三件套，悬空引用 0、空组 0、循环引用 0、孤儿规则集 0、重复名 0；默认生成物 96 规则 / 26 组 / 38 providers 引用问题 0 | E4 | group_reference_integrity.md（EXP-WP8-01）；WP-14 原型复跑 15 次硬失败 0 |
| 4.2 | 开关三联动：关组时组 + 其规则 + 其 providers 由同一开关在三个构建函数同步门控，实测无残留（S6：关 4 组连带 18 条规则、4 个 provider 同步消失） | E4 | 同上 |
| 4.3 | **单地区 default-selected 静默失效**：仅香港节点时 Claude/AI 的默认选中（美国）、TikTok/Financial 的默认选中（日本）指向未生成的地区组，按 wiki 语义静默回退首个成员（默认代理），不报错但设计意图失效；三件套一致。研究建议：生成时校验 default-selected 成员资格（未实施） | E4 + E2 | group_reference_integrity.md §3.2 |
| 4.4 | 空池 fail-fast：节点被过滤至空时 main() 在 filterAndNormalizeProxies 显式抛错、拒绝生成残缺配置（上游同源设计行为，非缺陷） | E4 | 同上（S3/S4；WP-14 复跑 PASS-EXPECTED-THROW） |
| 4.5 | empty-fallback 在现行生成逻辑下为纯防御层：全部通过场景无空成员组生成；其值 REJECT 为官方合规值（仅支持 proxy 名）。注意与 R-010 的区别——冲突点在「填组名」的历史用法与官方 parser 的禁止，TC-K-02 已由结项后专项实测裁决（EXP-R010-01~03：官方与公开 smart 内核均拒绝组名回填），转为常设回归用例锁死未来改型（候选值仅 REJECT / 节点名 / COMPATIBLE） | E4/E3 | group_reference_integrity.md §3.3；07-validation/test_strategy.md |
| 4.6 | 兜底段 3 条 IP 类 RULE-SET 未带 no-resolve，与全表其他 IP 规则写法不一致（风格项，无行为实锤） | E2 | rules_priority_and_providers.md |
| 4.7 | 规则集可靠性分级（38 个 provider，全 mrs / 86400s）：A- bett-rules via raw（34 个，89%）；B AWAvenue via jsDelivr（bundle 路径不存在、冷启动无兜底；jsDelivr 有 50MB 包体拒仓先例）；B- Emby/emos via jsdmirror（403 抖动实测记录；bundle 兜底加载 meta-rules-dat 的 category-emby，与远端原文不等价——隐性语义替换）；C cn_additional via 353355.xyz（无仓库/版本锚点，但仅用于 QUIC 豁免、爆炸半径全表最小） | E4（分级与 bundle 实测）/ E1（即时探活） | rules_priority_and_providers.md §3 |
| 4.8 | 冷启动 bundle 兜底实测：当前 BundleMRS.7z（84,596 条目）对 38 个 path-in-bundle 命中 33，缺失 5：fakeip_filter、microsoft_ip、apple_ip、tiktok_ip、avenue-ads | E4（EXP-WP8-02） | 同上 |
| 4.9 | 健康检查面：全组共用 apple.com success.html / interval 600 / timeout 3000 / lazy / max-failed-times 3 / url-test tolerance 50；expected-status 未设，「劫持型假活」（返回 200 的劫持页）不被识别——研究建议评估设 200（需所有者拍板，未实施） | E4/E2 | rules_priority_and_providers.md |

## 5. 节点识别与标准化（WP-9，03-technical-research/proxy_node_normalization.md + regex_coverage_matrix.csv）

实测基座：135 例合成夹具全量运行（通过口径含「缺陷行为与读码预测一致」）；66 条正则单元矩阵结果为 51 符合设计意图 / 10 漏识别 / 4 误判 / 1 争议。已实锤缺陷清单（F-01~F-21，均为 E4，除注明者）：

**漏识别类**
- F-01 **繁体字形全线漏识别**：台灣、臺灣、美國不命中任何地区——覆盖面最大的缺口（繁体是港台机场高频命名）。
- F-02 英文城市名不收：Tokyo、Osaka、Los Angeles、Dallas 等不命中（正则只收中文城市名 + 国家英文名）。
- F-03 名单外城市漏识别：如台中（台湾名单仅台北/高雄/新北/桃园/新竹）等。
- F-19 旧线台湾名单弱于 Go 线（hinet/新北/桃园/新竹仅 Go 命中）；旧 smart 无不可见字符剥离机制，零宽变体整词漏识别（F-11 的一半）。

**误判类**
- F-04 **`x86`/`x64` 被判高倍率**：RATE-HIGH 前缀分支使「香港 x86 优化」判为 ×86；开启「过滤高倍率」时会被误删——危险度最高的误判。
- F-05 版本号 `v0.5` 被判低倍率（RATE-LOW 的 0.[0-5] 分支）。
- F-06 `0.55` 边界误判：正则只约束首位小数，0.51–0.59 全部误入低倍率（设计边界 ≤0.5）。
- F-07 高倍率正则无信息词守卫：低倍率侧有 `(?!.*(剩|期))` 守卫、高倍率侧没有，「到期2倍」类文案漏网，守卫不对称。

**过滤与存活类**
- F-08 地区豁免使信息节点存活：「香港 剩余流量提示」因命中地区而豁免信息词过滤、进入地区组（公告节点混入地区组）。
- F-09 反向误删：无地区名的真实节点只要含任一信息词即被删（约 90 词词表，实测「公益免费节点」「国内中转」均被删），且无任何日志/提示。

**静默变更类**
- F-10 **标准化碰撞静默丢节点**：完全同名、旗帜差异归一（🇭🇰香港02 与 香港02）、空白折叠三类碰撞均使后到节点整节点丢失（含其不同 server/port），无警告。
- F-11 零宽变体绕过去重：匹配名剥离零宽字符、输出名保留，导致视觉同名双节点并存（与 F-10 相反方向的不一致）。
- F-12 dialer-proxy 目标失效（被过滤/不存在）时静默删除引用，链式节点静默降级直连；目标改名时引用可正确跟随（正例已验证）。
- F-13 ip-version 偏好覆写节点显式值：恰一开关开启时统一改写全部节点，与 Go 线「读现有值」哲学存在张力（注释明示为设计语义）；双开/双关不覆写。
- F-16 错旗保留：`🇺🇸 香港 01` 按文字归香港组、标准化保留原旗，组内旗帜与归属不一致。

**健壮性与跨线类**
- F-21 **畸形 name 使整份覆写崩溃**：name 缺失/数字/null 时 normalizeProxyName 抛 TypeError、main() 整体失败无降级；订阅源单个坏条目即全配置不可用。空字符串名则被静默保留。
- F-15 customPatch「台湾省」bug 复现：补丁硬编码组名「台湾省」与上游组名「台湾」对不上，custom 线的台湾低倍率组永不生成（Go 线已以地区注册表修复）。
- F-14 倍率判定跨线分叉：1.1x/1.5倍 仅 Go 系判高倍率，上游系不判——同一订阅跨设备分组不一致。
- F-20 「下载」借用低倍率语义：含「下载」且不含客户端/软件守卫词的节点一律判低倍率（上游经验规则，与倍率无关）。
- F-17/F-18 特性登记（非缺陷）：多地区多重归属（中转命名同时进两组）；「圣地亚哥」三线三结果（地名歧义，Go 移除为已记录取舍）。

**已验证的正例（防误判设计有效）**：Russia 的 us 子串被字母边界拦截；10.5x 不被低倍率误吞（小数点后顾）；Freedom 不命中 free（词边界）；1x/1.0倍 正确归标准倍率；0.6–1.0 为设计空档；「剩余0.5倍」被剩/期守卫挡住；空池抛明确错误；未知节点字段原样保留（无白名单重建丢弃）；定向改写面仅 name/dialer-proxy/ip-version/udp 四处。

**单点生死面**：全部地区/倍率正则重度使用 lookbehind。V8 与现代 JavaScriptCore 已实测支持（WP-14 探针 6/6，见 §6.3）；QuickJS/Boa 未测（R-012）。若目标引擎不支持，脚本整体失效——与 MyClash issue #65 的引擎语法类故障同型。

## 6. 客户端与引擎（WP-10，03-technical-research/client_compatibility.md）

| # | 发现 | 证据 |
|---|---|---|
| 6.1 | Bettbox 流水线：QuickJS 脚本段（extract_options 2s/32MB 只跑顶层提取 ruleOptionsEnable/serviceConfigs；evaluate 10s/128MB；GUI 选择 Object.assign 回注）→ Go applyPatch（general 整段 App 赢；dns 仅 override-dns=true 或脚本未启用时 App 替换，默认 false 故默认脚本赢；sniffer 整体替换；hosts 逐键 App 赢；rules 可被 prepend/override 收口；provider path 被 App 按 URL md5 重写）→ 内核段。脚本「赢」面比旧认知窄 | E3（源码直读，v1.19.7 HEAD 复核 2026-10-16 四项旧结论全部仍成立） |
| 6.2 | Bettbox 开关类型被钉死为 bool：非布尔默认值在 UI 层被强制转 true（`v is bool ? v : true`）——脚本作者不能用非布尔值表达「默认关」；此事实直接约束枚举类开关设计（DC-11 的前置） | E3 |
| 6.3 | 引擎矩阵现状：lookbehind 微探针 V8（Node 24）6/6、现代 JSC（Bun 1.4.4）6/6，Go 主版全脚本两引擎输出逐字节一致（sha256 同为 534724d7…）；QuickJS（Bettbox 目标引擎）与 Boa（CVR）两格未测；现代 JSC 结论不得外推老旧设备 JSC（lookbehind 系 Safari 16.4 起支持） | E4（EXP-WP14-03）；缺口 GAP-02 |
| 6.4 | CVR：Boa 引擎、超时 5s、配置上限 10MB；**fail-open**——脚本异常/超时/超限时记录日志并原样返回输入配置，覆写失败不阻断启动（与 Bettbox 的分类报错形成对照）；脚本见到全小写键；无 GUI 开关回注（ruleOptionsEnable 在 CVR 无效） | E3 |
| 6.5 | 裸 mihomo 无覆写层：脚本产物最终落回官方 schema 解析；组健康检查 url 只测 proxies 成员不测 provider 成员（WP-2）；`type: smart` 在官方内核不可用 | E3 |
| 6.6 | OpenClash 不运行 mihomo JS 覆写：其体系为 INI 覆写模块 + Shell/Ruby，优先级链为「订阅 < LuCI 生成 < 覆写模块/Shell」；桌面脚本迁移须转写，组装逻辑只能以 Shell 实现 | E2（仓库自带指南） |
| 6.7 | 同一脚本跨客户端的已知差异：GUI 开关回注仅 Bettbox 有；键大小写仅 CVR 小写化；失败语义 Bettbox 分类明确但 UI 处置未核、CVR 静默跳过；smart 组仅非官方内核可用 | E3/E2 |

## 7. 性能与资源（WP-11，03-technical-research/performance_and_resource_cost.md）

| # | 发现 | 证据 |
|---|---|---|
| 7.1 | 生成耗时量级：五脚本池化中位数（25/200/1000 节点）Go 主版 0.86/4.59/17.76 ms，全部变体 1000 节点 ≤25 ms；与 WP-9 独立测量（200 节点 3.2–3.6ms、2000 节点 27.5–32.3ms）同量级互证 | E4（池化 21 样本/格） |
| 7.2 | 变体间不可排名：共享沙箱噪声使极差上限不可信（离群样本达 232 ms）、排名轮次间翻转；可信结论只有量级——同规模同量级 | E4（含噪声如实标注） |
| 7.3 | 阶段分解（Go 主版）：filterAndNormalizeProxies 在 1000 节点约占总耗时 79%（9.20/11.69 ms），组/规则构建近常数；优化无实施必要 | E4 |
| 7.4 | 输出规模由代码常量决定：规则数（96）与规则集数（38）三档恒定、不随节点数变化；1000 节点输出 JSON 约 331–374 KB；脚本本体 gzip 后 14–24 KB | E4 |
| 7.5 | 首启下载量：HEAD 实测 Go 线 37 个唯一规则集文件合计约 876 KiB，上游线 45 个约 888 KiB，同量级（当日快照） | E4（HEAD 实测） |
| 7.6 | 生成阶段与网络完全解耦：五脚本源码网络 API 零命中；同输入两次输出哈希一致；输入含不可达 provider 时生成 3 ms 成功且不透传——不可达的等待只发生在 mihomo 运行时 | E4（EXP-909） |
| 7.7 | 运行时冷启动端到端、规则集加载/更新耗时、运行时内存/CPU 本环境不可测，未编造数字；四步测量方案已给出并入 Backlog（BL-108/109） | —（方案，见原文 §6.2） |

## 8. Smart 线（WP-10 §5 / ADR-004）

| # | 发现 | 证据 |
|---|---|---|
| 8.1 | 官方主线 v1.19.33 对 lightgbm/smart 代码搜索 0 命中，主线不存在 smart 组与分支 | E3（否定性检索） |
| 8.2 | 实现位于下游 lux5am/mihomo-smart：仅 Alpha 分支、唯一 Release 为 2025-09-17 Prerelease-Alpha、18 stars，无正式版节奏；供应链成熟度远低于主线 | E3 |
| 8.3 | smart 组参数以 fork 源码标签为准（policy-priority/uselightgbm/collectdata/prefer-asn）；社区模板所称 type-priority/sticky-sessions/lgbm-auto-update 等键与该 fork 标签不完全同名，跨模板抄参数有静默失效风险 | E3 |
| 8.4 | KevinChen222 feat/smart-core 个人分支公开不可达（其名下 6 个公开仓无 Bettbox fork、官方 Bettbox 无 smart 分支）；其内核来源、与 lux5am fork 的关系、6 个 GUI 开关现状全部未验证——不得以历史印象替代证据 | E3（否定性证据）；状态=未验证（R-009/GAP-04） |
| 8.5 | 脚本侧仅置 uselightgbm=true（默认关、opt-in）；开启后内核按默认地址下载 Model.bin（vernesong Release），失败自动回退统计选路；模型许可/训练数据未单独声明（LIC-11） | E3/E2（T-09 评级低） |
| 8.6 | 官方内核加载 `type: smart` 配置的确切行为（报错文本/是否整表拒绝）未实测 | 未验证（WP-10 清单 3；TC-K-04 承接） |

## 9. 官方语义基线要点（WP-2，03-technical-research/mihomo_config_semantics.md）

- 顶层 ipv6 管流量面（默认 true）、dns.ipv6 管解析面（默认 false，AAAA 回空），两者独立；节点 udp 默认 false（direct/dns 等类型除外）；组级 disable-udp 可整体禁用。
- 两个硬性启动错误：dns.enable 且 nameserver 空；respect-rules 且未配 proxy-server-nameserver。
- 组健康检查 url 只测 proxies 成员、不测 provider 成员；empty-fallback 文档与源码一致仅支持 proxy 名；结项后双内核真二进制实测已证组名回填在官方与公开 smart 分叉均被拒绝（见 §4.5 与 R-010 裁决）。
- 已移除而非弃用：组级 interface-name/routing-mark（解析器按已移除处理）；fallback-filter.geosite 已废弃、relay 组已弃用。
- TUN stack 现行默认 mips；sniffer override-destination 默认 true（文档示例 false 为示例值）；dns.listen 为空时的行为、fake-ip-ttl 单位等查无依据项已逐条登记（原文 §H-5，归 GAP-09/U-DNS 系列）。

*本汇编的运行时对应物——哪些发现在真实内核/客户端上已被证实——答案是：无一。本项目全部 E4 止步生成级，运行时验证路径见 07-validation/validation_gaps.md（GAP-01）与 NEXT_PHASE_BACKLOG.md 的 BL-108/109。*


---
**修订记录**：2026-10-28 结项后一致性修订（以仓库基线 2647da73 为准）——R-010 裁决、DC-01/DC-02 拍板进展、ISSUE-003 关闭与登记口径（来源 257 条 / 实验 27 条）已同步；原始研究结论与不利发现未改动。详见 09-final/CLOSURE_REVISION_REPORT.md。