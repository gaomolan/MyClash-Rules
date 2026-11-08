# MyClash 网络隐私与遥测防护：盘点与改进报告

> 审计对象：`myclash-rules` 分支及其 Go 主脚本、Combo 变体、规则集、测试与 GitHub Actions  
> 执行分支：`feat/privacy-defense-audit-upgrade`  
> 报告性质：代码审计 + 外部方案研究 + 本次改进记录  
> 重要边界：静态代码审计不等于 Android 真机流量验证；本报告不会把未执行的测试写成通过。

## 执行摘要

本次审计确认，仓库已经具备广告/追踪规则集、厂商 Native Tracker 名单、应用进程拦截、DNS/TUN 配置和规则存活巡检等基础能力，但防护能力分散在 Go 主脚本与 Combo 变体之间，自动化验证也没有覆盖最重要的两个生成脚本。

本次优先处理了三个可明确复现的工程问题：

1. SystemHelper 的进程与域名拦截此前排在 `private` 直连规则之后，可能被更早规则放行。现已调整为应用级进程/域名拦截先于 private。
2. Combo 差异层仍使用旧开关锚点，主脚本新增 SystemHelper 开关后，`node Script/build-variants.js` 会因锚点失效而停止。现已修复锚点并按生成器逻辑重新生成 Combo。
3. 现有测试对象清单只登记仓库已删除的旧版 `Script/Script.js` 和 `Script/mihomoScript.js`，导致 CI 在测试启动阶段就会报文件不存在；同时也没有覆盖 Go 主脚本与 Combo。CI 的路径过滤还漏掉嵌套差异层和 ruleset 变化。现已对齐维护脚本清单、增加专门回归测试，并让 PR CI 执行变体再生成与一致性检查。

总体判断：当前应把目标从“堆叠更多规则”调整为“防护策略统一、优先级可证明、变体可重复生成、规则源可审计、设备端可验证”。

---

## 第一部分：详细盘点

### 1. 仓库现有防护资产

| 资产/模块 | 现状 | 审计判断 |
|---|---|---|
| `mihomoScriptGo.js` | 通用主脚本；广告拦截、SystemHelper、STUN、QUIC、DNS、TUN 等逻辑 | 是应当维护的通用底板 |
| `mihomoScriptGo-combo.js` | Go 主脚本派生；包含 Spark 专属逻辑和更完整的主防线 | 通用防护与个人定制混在变体中 |
| `combo.json` | 21 个 find/replace 操作生成 Combo | 锚点对源文件结构敏感，必须自动验证 |
| `native-vivo.txt` | Vivo 相关域名名单 | 有资产，但缺少条目级来源、置信度和分类元数据 |
| `native-huawei.txt` | Huawei 相关域名名单 | 同上 |
| `defense-exceptions.list` | classical 例外名单 | 可作为误杀恢复通道，但必须避免绕过应用级硬封锁 |
| AWAvenue | Combo provider | 通用 Go 主脚本未获得同等主防线覆盖 |
| AdRules | Combo provider，完整防线模式使用 | 规模大，需独立评估误杀、内存和下载成本 |
| BanProgramAD | Combo provider | 针对部分国内 App 广告/统计回传的补充名单 |
| 定点规则 | Combo 中有少量手工域名规则 | 需要记录证据、作用范围和复核日期 |
| 规则存活巡检 | `rules-canary.yml` | 已有远程依赖探活，但探活不代表内容正确或规则有效 |
| 变体生成 | `build-variants.js` | 具备锚点唯一性和生成后语法校验设计 |
| 测试 | 旧脚本通用测试套件 | 原先仍引用已删除的旧脚本，且没有覆盖 Go 主脚本和 Combo 生成产物 |

### 2. 规则优先级与拦截边界

Mihomo 规则按配置顺序匹配，先命中的规则生效。因此规则位置是防护功能的一部分，不是排版问题。

审计发现的优先级风险：

- SystemHelper 进程规则在 `RULE-SET,private,直连` 后面。若连接先命中 private，后面的进程规则不会再执行。
- Combo 的全局例外名单会对命中的域名执行直连，因此必须保证它不能出现在目标应用级封锁之前。
- 全局 `DST-PORT` 规则不区分应用，端口 18080/18081 可能被其他应用使用；同时 private 例外仍可能优先放行私有 IP 连接。
- 规则集被加载不代表规则一定命中；规则优先级、域名解析路径、应用归属和是否经过 TUN 都会影响结果。

本次已将 SystemHelper 的进程与域名规则放到 private 直连之前。端口规则仍保留在 private 之后，以避免无差别破坏局域网服务；因此不能把端口兜底描述成对所有私有 IP 连接的绝对封锁。

### 3. 主脚本与 Combo 能力不一致

Combo 已经包含以下主防线组件，而普通 Go 主脚本没有相同的完整组合：

- AWAvenue
- AdRules
- Native Vivo
- Native Huawei
- BanProgramAD
- defense-exceptions
- 手工定点规则

这会造成一个重要认知风险：用户使用 Go 主脚本时，不能假设自己同时获得了 Combo 的完整防线。

建议后续把防护能力拆成可复用的通用模块，Go 主脚本和 Combo 共享同一套防护定义；Combo 只保留 Spark 节点分组等真正的个人定制。此项涉及 provider、策略组、例外优先级和规则规模的整体迁移，本次不贸然将约 20 万条规则直接并入普通主脚本，以免未经设备容量和误杀评估就扩大默认拦截面。

### 4. DNS、TUN 与设备级防护

当前脚本已有 Fake-IP、DNS 劫持、TUN strict-route、IPv6 与 WebRTC 开关。这是良好基础，但仍有边界：

- Android Private DNS / DoT、应用自带 DoH 或其他加密 DNS 可能使域名过滤看不到真实查询。
- CNAME Cloaking 需要解析器检查 CNAME 链；普通静态域名规则不能自动等同于 CNAME 追踪检测。
- ECH 会减少中间层可见的 TLS 主机名信息，不能把 SNI 嗅探当作唯一识别方式。
- HTTPS 加密请求中的 API 路径和请求体通常不可由 Mihomo 普通规则识别。
- 任何绕过 Mihomo TUN 的流量都不在脚本规则的可靠控制范围内。

建议后续把 DNS 防绕过作为独立模式设计，并用 Android 实际 Private DNS 状态、DoT/DoH 应用、IPv6 和 VPN 断线场景进行验证。不要未经兼容性测试就封锁所有 443、853 或未知 DNS 端点。

### 5. 代理入口暴露面

Go 主脚本在输入配置缺少对应字段时，会补充：

- `allow-lan: true`
- `bind-address: "*"`

这可能让代理监听入口暴露到局域网接口。对 Android 手机而言，默认开放 LAN 并非最小权限；但对软路由或需要局域网共享代理的用户，关闭它又可能破坏现有使用方式。

建议未来增加明确的设备/场景配置档：手机默认关闭 LAN 监听；软路由由用户显式启用并限制可信网段，必要时启用认证。本次未擅自改默认值，以免破坏既有共享代理场景。

### 6. 规则名单质量与可追溯性

现有 Native 名单以纯域名文本保存，便于 Mihomo 直接消费，但缺少每个条目的：

- 上游来源与原始链接
- 归类依据（广告、分析、诊断、崩溃、升级、推送、账号等）
- 置信度和影响等级
- 首次发现与最后复核时间
- 是否有业务功能依赖
- 误杀申诉/例外原因

这会让后续维护者难以判断某个域名究竟是明确遥测端点，还是系统必要服务。尤其厂商 Native Tracker 中可能混有系统配置、推送、账号和升级端点，不能只凭域名中出现 log、metric、event 等词就封锁。

建议建立规则源登记表和条目证据记录；高影响规则先观察、再按品牌/应用启用，不应全部默认开启。

---

## 第二部分：外部开发者方案与可借鉴技术

以下项目的价值不在于照搬全部名单，而在于它们各自解决了不同层面的识别问题。

| 项目/技术 | 主要做法 | 对 MyClash 的可借鉴点 |
|---|---|---|
| [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists) | 分层维护广告、追踪器、Native Tracker、威胁情报名单 | 按风险分级；厂商名单独立；不要叠加所有强度等级 |
| [TrackerControl](https://github.com/TrackerControl/tracker-control-android) | 结合应用追踪器数据库与运行时连接观察 | 用真实应用流量发现端点，而不只依赖静态名单 |
| [RethinkDNS](https://github.com/celzero/rethink-app) | 应用级流量日志、按应用/IP 控制 | 将应用身份、目的地和时间关联起来；用作临时审计工具 |
| [NextDNS CNAME Cloaking](https://github.com/nextdns/cname-cloaking-blocklist) | 识别第一方子域背后的第三方 CNAME 追踪 | 评估 DNS 解析器层面的 CNAME 链检测，不能只转换成静态域名名单 |
| [StevenBlack Hosts](https://github.com/StevenBlack/hosts) | 多来源聚合、去重、生成不同强度版本 | 建立规则源合并、重复率、差异量和版本报告 |
| [Mihomo 官方规则文档](https://wiki.metacubex.one/config/rules/) | PROCESS-NAME、DST-PORT、NETWORK、AND/OR/NOT 等规则能力 | 应用身份、协议和端口组合使用，避免单一全局端口规则误伤 |
| [Android VPN 文档](https://developer.android.com/develop/connectivity/vpn) | Always-on VPN 与阻止 VPN 外连接 | 将系统级 VPN Lockdown 作为 TUN 之外的最后一道边界 |

### 值得纳入未来架构的技术

1. **应用身份匹配**：PROCESS-NAME / UID 与域名规则配合；高置信度应用级封锁优先于通用直连和例外。
2. **协议与端口复合匹配**：使用 NETWORK + DST-PORT + 应用身份组合缩小误伤范围；只有证据充分时才使用全局端口封锁。
3. **厂商 Native Tracker 分层**：Vivo、Huawei、Xiaomi、OPPO/Realme、Samsung、Apple 等独立 provider 和开关。
4. **移动 SDK 追踪器数据**：参考 Tracker Radar / Disconnect 等数据源，但将“APK 中存在 SDK”与“运行时实际发出连接”分开标注。
5. **DNS 隐蔽追踪识别**：研究 CNAME 链、Private DNS、DoT、DoH 和 ECH 对识别能力的影响。
6. **威胁情报分层**：恶意软件、钓鱼、C2、NRD、DGA 与广告/遥测分开；高误报类别默认不启用。
7. **规则质量流水线**：源文件完整性、解析、去重、差异阈值、格式编译、生成配置测试、回归测试和失败回滚。

---

## 第三部分：本次已实施改进

### A. SystemHelper 应用级规则优先级

文件：`Script/mihomoScriptGo.js`

已调整为：

1. `PROCESS-NAME,com.mobiletools.systemhelper,REJECT`
2. `DOMAIN,dm.wo.com.cn,REJECT`
3. `RULE-SET,private,直连`
4. 独立端口兜底规则
5. 国内直连规则

这样目标应用的进程封锁不会被普通 private 直连提前接管。域名兜底也先于 private。全局端口规则仍保留独立开关，并保留其可能误伤其他应用的说明。

### B. 修复 Combo 差异层生成锚点

文件：`Script/variant-layers/combo.json`

上一轮 SystemHelper 开关已写入源脚本，但 Combo 差异层仍查找旧的：

`屏蔽STUN端口: false,
};`

实际源文件在这段后面已有 SystemHelper 配置，导致锚点失效。现已更新为匹配当前真实源结构，并保留完整防线开关注入。

### C. 重新生成 Combo 产物

文件：`Script/mihomoScriptGo-combo.js`

已按仓库 `build-variants.js` 的同一套逆序锚点替换逻辑应用全部 21 个差异操作，生成新产物。生成结果已确认包含 SystemHelper 进程规则。

### D. 新增隐私防护回归测试

新增：`Test/suites/privacy-defense.js`

测试覆盖 Go 主脚本与 Combo 生成版：

- SystemHelper 进程/域名规则是否存在。
- 两项应用规则是否先于 private 直连。
- private 是否先于国内直连。
- 应用级拦截开关关闭后是否移除对应规则。
- 端口开关是否独立工作。
- Combo 完整防线组件顺序是否正确。
- 例外名单是否排在 SystemHelper 应用封锁之后。
- Combo 轻量模式是否只移除 AdRules，而保留其他防线组件。
- provider 是否与规则引用对应。

已在 `Test/run-tests.js` 中接入该测试套件。旧通用测试清单已移除失效的旧文件引用；Go 与 Combo 改由隐私防护专项测试覆盖，并继续进入 ES2020 / QuickJS 兼容性检查。

### F. 扩展并建立自动更新的厂商 Native Tracker 库

新增来源登记：`ruleset/native-trackers.sources.json`。

当前接入 HaGeZi 官方 `wildcard/*-onlydomains.txt` 来源，共 11 个厂商/平台列表，快照合计 3,183 条（按各源声明计数，跨源可能重复，不代表 3,183 个唯一域名）：

| 厂商/平台 | 上游条目数 | 开关默认值（Go 主脚本） |
|---|---:|---|
| Vivo | 243 | 关闭 |
| Huawei | 135 | 关闭 |
| Xiaomi | 349 | 关闭 |
| OPPO / Realme | 496 | 关闭 |
| Samsung | 201 | 关闭 |
| Apple | 104 | 关闭 |
| Microsoft / Windows / Office | 365 | 关闭 |
| Amazon | 373 | 关闭 |
| TikTok | 545 | 关闭 |
| LG webOS | 315 | 关闭 |
| Roku | 57 | 关闭 |

新增文件：`ruleset/native-*.txt`。所有名单均保留 HaGeZi 上游元数据、许可证链接、版本和条目数量。

**启用策略：**
- Go 主脚本新增 11 个品牌独立开关，全部默认关闭；只启用实际使用的设备品牌/平台，避免跨品牌误伤。
- Combo 保留此前已经启用的 Vivo / Huawei 行为；其余新增品牌默认关闭。
- 关闭某品牌时，同时移除对应规则引用和 provider，不仅仅是隐藏策略组。

**自动更新：**
- 新增 `scripts/sync-native-trackers.sh` 与 `.github/workflows/sync-native-trackers.yml`。
- 每 6 小时同步一次 HaGeZi 官方源，也支持手动触发。
- 更新前校验上游标题、许可证、格式声明、条目数元数据、实际行数、纯域名语法和最低条目阈值。
- 相比上一版若条目数量缩减到一半以下或增长超过两倍，则停止更新并要求人工审查，防止空文件、截断或异常源覆盖可用名单。
- 同步失败不会覆盖现有快照。

这次接入的是 HaGeZi 每个厂商的完整独立名单，不是“零误伤基础名单”。因此所有新品牌在通用 Go 主脚本默认关闭；厂商名单可能影响设备功能，启用前应按实际品牌测试。

### E. 强化 GitHub Actions

文件：`.github/workflows/format_and_test.yaml`

已调整：

- push 监控分支包含默认分支 `myclash-rules`，同时保留 `main`。
- PR 与 push 的路径覆盖改为 `Script/**`、`ruleset/**`、`Test/**`，避免漏掉嵌套差异层和规则集。
- 测试前先运行 `node Script/build-variants.js`。
- 使用 `git diff --exit-code -- Script/mihomoScriptGo-combo.js` 检查提交的生成产物是否与源文件和差异层一致。
- 再执行现有完整测试。

这样今后只要改动 Go 源文件或 Combo 差异层，PR 就会验证生成物是否同步，而不是仅验证旧版脚本。

---

## 第四部分：尚未实施、需要后续专项验证的事项

| 优先级 | 项目 | 原因与实施条件 |
|---|---|---|
| P0 | Android 真机验证 SystemHelper | 需要设备日志确认包名识别、域名兜底和端口实际命中 |
| P1 | Go 主脚本与 Combo 防护模块统一 | 涉及 provider、规则规模、例外名单、策略组和默认开关，需要单独迁移与容量测试 |
| P1 | Native 名单证据化 | 补充来源、分类、置信度、更新时间和必要业务标记 |
| P1 | DNS 防绕过模式 | 需要分别验证 Private DNS、DoT、DoH、IPv6、ECH 场景 |
| P2 | CNAME Cloaking | 需要具备检查 CNAME 链的 DNS 层能力，不能仅靠静态 RULE-SET 假装完成 |
| P2 | 其他厂商 Native Tracker | 先获取上游清单并与现有规则去重、验证误杀，再按厂商独立接入 |
| P2 | 威胁情报规则 | 将恶意域名/IP 与广告遥测分离，采用独立开关和风险等级 |
| P2 | LAN 监听安全档 | 手机与软路由默认行为不同，需增加明确场景选项而不是统一硬改 |
| P3 | 运行时流量发现工作流 | 用 TrackerControl / RethinkDNS 临时审计设备流量，再将证据沉淀为规则 |

### 不建议直接做的事情

- 不要把所有厂商域名、所有广告名单、所有威胁情报名单合并成一个巨大 REJECT 集合。
- 不要封锁所有 UDP、所有 443 或所有 853 来“防绕过”。
- 不要仅凭域名关键词判断一个系统服务是遥测。
- 不要把 CNAME Cloaking、ECH 或加密 API 路径检测写成 Mihomo 静态规则已经能完成的功能。
- 不要把规则数量、provider 下载成功或脚本生成成功当作设备端拦截成功。

---

## 第五部分：验证状态与验收标准

### 本次已完成的静态验证

- Combo 差异层 21 个操作已按生成器规则成功应用。
- 11 个 HaGeZi Native Tracker 源已抓取并核对上游声明条目数，共 3,183 条（跨源可能重复）。
- Native Tracker 来源登记、域名快照、品牌开关、provider 与规则引用已建立一一对应。
- 新生成 Combo 文件已确认包含 SystemHelper 包名拦截规则。
- 新增测试覆盖 Go 与 Combo 两个输出目标。
- CI 已增加生成产物一致性检查和嵌套目录触发路径。

### GitHub Actions 实际执行结果

上一轮 CI Run #30 已通过原有 18 项测试。本轮增加了 11 个品牌开关、来源快照检查和同步工作流后，新的 CI 结果尚待本轮提交触发，不沿用上一轮通过结论。

**上一轮 CI 通过**

PR 工作流 `format_and_test` 第 30 次运行（2026-11-08，Node.js 24）已成功完成：

- `node Script/build-variants.js`：成功，Combo 变体由 21 个差异操作重新生成。
- `git diff --exit-code -- Script/mihomoScriptGo-combo.js`：成功，生成物与提交文件一致。
- `node Test/run-tests.js`：成功，18 项通过、0 项失败。
  - 隐私防护专项：8 项通过。
  - ES2020 兼容性：4 项通过（Go / Combo 各两项）。
  - QuickJS：6 项通过（Go / Combo 顶层执行、main 调用和 Node 输出结构对照）。

上一轮工作流链接：https://github.com/gaomolan/MyClash-Rules/actions/runs/42503120389

这验证了脚本生成链路、JavaScript 语法/引擎兼容性和本次新增规则回归；它仍不等同于 Bettbox 所用 Mihomo 二进制内核的配置解析，也不等同于 Android 真机流量测试。

### 真机验收

需要在 Bettbox / Android 上确认：

1. SystemHelper 进程规则实际命中。
2. 域名兜底实际命中。
3. 18080/18081 的协议、目标地址和其他应用影响。
4. Wi-Fi 与移动网络下 IPv4/IPv6 的差异。
5. Android Private DNS 开关对 DNS 过滤的影响。
6. VPN 断开或 TUN 不接管时是否存在流量绕过。

**验收结论：本次完成了高置信度代码修复、生成链路修复和测试/CI 补强；在 GitHub Actions 与 Android 真机结果出来之前，不把本次工作标记为完整防护验收通过。**
