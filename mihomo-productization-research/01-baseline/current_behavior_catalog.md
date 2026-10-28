# WP-1 现状行为目录 — 脚本数据流、函数、开关与字段策略

- 基线：目标仓 HEAD `cc46de0`、上游 HEAD `071d4ec`（2026-10-28 审计）
- 行号均指 Go 主版 `Script/mihomoScriptGo.js`（1988 行），另注明者除外
- 证据：E4 = 本次运行/静态实测；E2 = 源码直读

## 1. 数据流（四条线共用同一管线，Go 线为最完整形态）

```
输入 config（订阅 YAML 经客户端解析）
  │
  ├─ 前置校验：含 proxy-providers 即抛错终止（main L1819-1821，E2）
  │
  ├─ ① 节点过滤与标准化 filterAndNormalizeProxies (L965)
  │     剥零宽/不可见字符 → toMatchableName 归一匹配名 (L888)
  │     地区识别 getMatchedRegions (L893) / 倍率识别（rate 正则）
  │     按开关过滤：低倍率 / 高倍率 / 非地区节点
  │     normalizeProxyName 改名 (L909) + renameMap
  │     fixDialerProxy 按改名图修复 dialer-proxy 引用 (L932)
  │     getIpVersionPreference 处理 ip-version 偏好 (L953)
  │
  ├─ ② 代理组生成
  │     buildCustomizeGroups (L1143) → 自定义节点组
  │     buildRegionGroups (L1096) → 地区组三件套（手动/Auto/Eco-Auto）
  │       createRegionGroup (L1045)
  │     buildFunctionalGroups (L1327 编排)
  │       ├ buildFunctionalContext (L1188)
  │       ├ buildServiceGroups (L1202) ← serviceConfigs (L460) 数据驱动
  │       ├ buildServiceRules (L1290)
  │       └ buildRuleProviders (L1307) ← baseRuleProviders (L304) + 各服务 providers
  │
  ├─ ③ DNS 与 hosts buildDnsAndHostsConfig (L1686)
  │     applyHostsToProxies (L1561) / matchDomainPattern (L1521) 等
  │     合并输入已有的 nameserver-policy / proxy-server-nameserver-policy /
  │     fake-ip-filter（展开保留，非整体替换，E2）
  │
  └─ ④ 顶层组装 main (L1818)
        newConfig = {...config} 铺底
        dns/hosts ← ③（脚本全权）
        连接面字段 ← === undefined 才补默认（见 §4）
        proxies ← ③映射结果 + 自定义组节点 + 5 个内置直连变体
                （双栈/IPv4优先/IPv6优先/仅IPv4/仅IPv6，运行实验确认，E4）
        proxy-groups ← [GLOBAL, ...功能组, 自定义组, 直连组, ...地区组]
        rules ← prefixRules (L124) + [STUN 屏蔽] + [QUIC 屏蔽]
                + 功能规则 + 兜底五条（cn 直连 / geolocation-!cn 默认代理 /
                cn_ip / private_ip / MATCH 漏网之鱼）
        WebRTC 修复：仅给 udp === undefined 的普通节点补 udp:true（L1963 起，E2）
```

上游/旧线差异：管线同构，但上游 `main()` 以空对象从零构建并无条件赋值连接面（见 §4 对照）；上游地区组受 `极简模式` 开关门控，Go 线已删除该开关。

## 2. 函数清单（Go 主版 22 个顶层函数）

| 阶段 | 函数（行号） | 职责 |
|---|---|---|
| 静态数据 | prefixRules (L124)、baseRuleProviders (L304)、groupBaseOption 家族 (L402)、serviceConfigs (L460) | 前置规则、规则集、组公共参数（健康检查 apple.com、interval 600、empty-fallback REJECT）、服务组定义表 |
| 节点处理 | toMatchableName (888)、getMatchedRegions (893)、normalizeProxyName (909)、fixDialerProxy (932)、getIpVersionPreference (953)、filterAndNormalizeProxies (965) | 名称归一、地区/倍率识别、改名与引用修复、过滤 |
| 组生成 | createRegionGroup (1045)、buildRegionGroups (1096)、buildCustomizeGroups (1143) | 地区组与自定义组 |
| 功能组 | buildFunctionalContext (1188)、buildServiceGroups (1202)、buildServiceRules (1290)、buildRuleProviders (1307)、buildFunctionalGroups (1327) | 服务组/规则/规则集的总装（Phase 3 由上游单体函数拆分） |
| hosts/DNS | hostSpecificity (1511)、matchDomainPattern (1521)、applyHostsToProxies (1561)、stripDnsSuffix (1608)、isIpAddress (1628)、simplifyDomainPolicy (1635)、buildDnsAndHostsConfig (1686) | hosts 映射与 DNS 全套构建 |
| 入口 | main (1818) | 编排与顶层组装 |

Go-smart 另有 `buildSmartBaseOption`（23 函数）；combo 另有 `splitComboSparkProxies`、`createComboSparkRegionGroup`、`buildComboSparkGroups`（25 函数）。上游为 18 函数（无上述拆分与专属函数）。

## 3. 开关 → 行为映射（Go 主版 `ruleOptionsEnable`，共 36 个）

门禁语义（2026-10-20 加固后，E2/E4）：分流组、规则、规则集三处门禁均为「`=== false` 才跳过」——Bettbox GUI 传入的开关表整表替换脚本默认时，缺失键视为开启；默认关闭型开关（过滤类、屏蔽类）不纳入此语义、仍按缺失=关闭处理。

| 开关 | 默认 | 行为 |
|---|---|---|
| 手动选择 / Auto / 负载均衡 | true/true/true | 三个基础策略组的生成开关（Auto 为改名后的自动选择组） |
| FCM / YouTube / Google / AI / GitHub / Claude / Microsoft / Apple / Telegram / TikTok / Twitter / Meta / Emby / PikPak / Financial / AdBlock / Cloudflare | 全部 true | 各服务分流组的生成+其规则+其规则集三联动；Claude 独立于 AI；Financial 为 Crypto 与传统金融合并组 |
| 显示低倍率节点 / 显示高倍率节点 | true/true | 只控制倍率组的 hidden 显隐，组本身仍生成可用 |
| 生成地区自动选择组 | true | 地区 Auto/Eco-Auto 组生成总闸之一 |
| 隐藏地区手动选择组 | false | 地区手动组 hidden |
| 生成倍率组 | true | 低/高倍率节点组与地区 Eco-Auto 的生成开关（曾为死开关，2026-10-20 接通，`!== false` 判定） |
| 分流组添加所有节点 | false | 服务组成员是否纳入全部节点 |
| 过滤低倍率节点 / 过滤高倍率节点 | false/false | 从节点池剔除对应倍率节点（与「显示」开关分工：过滤=删除、显示=隐藏） |
| 过滤非地区节点 | true | 剔除无法识别地区的节点（信息类节点如「剩余流量」靠它清理） |
| 屏蔽国外QUIC | true | 注入 QUIC 屏蔽规则；同时门控 cn_additional 规则集（buildRuleProviders L1307） |
| 代理IPV4优先 / 代理IPV6优先 | true/false | 统一改写订阅节点 ip-version 偏好；两者同开时互抵不生效 |
| IPv6总开关 | false | 仅控制 `dns.ipv6`（与 WebRTC 开关做与逻辑）；**不**管顶层 ipv6（已知缺口，注释明示） |
| 启用Sniffer配置 | false | 开启后脚本写入完整 sniffer（含金融 skip-domain 名单）；Bettbox 覆写开启时由 App 整体替换 |
| WebRTC走代理 | true | 三件套：顶层 ipv6 未设置时置 false、dns.ipv6 与逻辑、缺省 udp 节点补 udp:true（显式 udp:false 原样保留） |
| 屏蔽STUN端口 | false | 注入 STUN/TURN 常见端口拦截规则，优先级高于开关1；注释明示非常用端口可漏网 |

Go-smart 增补 5 个（默认全 false）：Smart启用GBM模型 / Smart优先ASN / Smart收集训练数据 / Smart低倍率优先 / 日志级别调试。combo 开关集与 Go 主版**逐一相同**（E4 解析比对）。
旧 Smart 线为另一套：上游 36 + 6（含单开关 `防WebRTC泄露`），与 Go 线不可直接互译（见差异报告 §4）。

## 4. 配置字段读写与覆盖策略（WP-1.11 核心）

### Go 主版（main L1818-1988，E2 逐行核对）

| 类别 | 字段 | 策略 |
|---|---|---|
| 透传保留 | 输入的全部未触及字段 | `{...config}` 铺底；含 external-controller/secret 原样保留（脚本明确不写） |
| 缺失才补默认（`=== undefined` 判定） | mixed-port（与 port 皆缺才补 7890）、allow-lan、mode、log-level、bind-address、unified-delay、tcp-concurrent、keep-alive-interval、find-process-mode、external-ui(-url)、geo-auto-update、geo-update-interval、etag-support、geox-url、ntp（整段缺失才补）、tun（逐子项判定 enable/auto-route/strict-route/auto-redirect/auto-detect-interface/dns-hijack） | 连接面归 App 的实现：App 已设值一律尊重；端口用 `=== undefined` 而非 falsy，`0`=明确禁用不被误开 |
| 故意不补 | socks-port / redir-port / tproxy-port | 缺失=不启用，多一个监听多一个暴露面（注释明示） |
| 条件写入 | 顶层 ipv6 | 仅「未设置 且 WebRTC走代理开」时置 false；App 已设 true 时脚本关不掉（已知缺口） |
| 脚本全权覆写 | dns、hosts、proxies、proxy-groups、rule-providers、rules、profile（store-selected/store-fake-ip 固定写入） | 分流/DNS 面归脚本的设计边界 |
| 条件全权 | sniffer | 仅开关开启时整段写入 |

### 上游对照（main L1677 起，E2）

`const newConfig = {}` 从零构建：`mixed-port/allow-lan/ipv6/mode/log-level/...` 全部**无条件赋默认值**（ipv6 恒 true），输入配置的连接面设置不被保留。这是两线最根本的行为分叉，也是 Go 线「读现有值、缺失才补默认」哲学的具体落点——该哲学**只存在于 Go 线**，custom 线（上游生成）不具备。

### 节点对象处理（E2）

- 改名/修复均以展开复制方式进行（如 WebRTC 修复 `{...proxy, udp: true}`），未见按白名单重建节点对象的代码——订阅节点的未知字段不会被结构性丢弃（个别字段的定向改写除外：ip-version 偏好、名称、dialer-proxy 引用）。
- `undefined/null/false/0/空值` 区分：连接面用 `=== undefined` 严格判定（保 0/ false 语义）；开关门禁用 `=== false`/`!== false` 两分；节点 udp 用 `!== undefined` 判定「未声明」。三类判定在代码中各自一致，未发现混用 falsy 的位置（抽查范围：main 与 buildRuleProviders；全量逐行审查不在本 WP 范围）。

## 5. 功能目录（现状能力清单）

| 功能 | 代码位置（Go） | 开关 | 在用线 | 测试覆盖 |
|---|---|---|---|---|
| 地区/倍率识别与组生成（含 Eco-Auto） | L888-1142 | 生成地区自动选择组/生成倍率组/显示·过滤系列 | 全部 | 无（三件套不在 Test 范围） |
| 服务分流（20 组，数据驱动） | serviceConfigs L460、buildServiceGroups L1202 | 各服务开关 | 全部（构成不同） | 无 |
| Claude 独立组 + ASN 399358 兜底 | serviceConfigs、buildServiceRules | Claude | Go 三件套 | 无 |
| AI 组（category-ai-!cn 为底+手写补缺口） | 同上 | AI | Go 三件套 | 无 |
| DNS 全套（fake-ip、respect-rules、策略合并、ECS 无关化） | buildDnsAndHostsConfig L1686 | IPv6总开关等 | 全部（细节有差） | 无 |
| WebRTC 双开关防护 | main L1963 起 + prefixRules 后注入段 | WebRTC走代理/屏蔽STUN端口 | Go 三件套（旧 smart 为单开关版） | 无 |
| Sniffer 预置（金融跳过名单） | main sniffer 段 | 启用Sniffer配置 | Go 三件套 | 无 |
| 链式代理引用修复 | fixDialerProxy L932 | 无（恒开） | 全部（上游同源） | 无 |
| Spark 双池隔离（港/新专属组、通用池隔离） | combo 专属 3 函数 | 无（结构性） | combo | 无（人工实测 25 项，2026-10-27） |
| 低倍率地区组追加（补丁形态） | customPatch.js 全文 | CUSTOM_LOW_RATE_AUTO_SELECT_ENABLED | custom 线、旧 smart（并入） | 无 |
| 规则存活巡检 | tools/rules-canary/check-rules.mjs + workflow | —（CI） | 仓库级 | 巡检本身即测试（69/69，2026-10-27 首跑） |

## 6. 静态检查与测试实测（WP-1.13/1.14，E4）

- `node --check`：目标仓 6 个 JS + 上游 2 个 + archive 2 个 + 巡检脚本，**全部语法通过**。
- 现行 Test 套件实跑（克隆内，同一环境）：
  - 上游克隆：`node Test/run-tests.js` → **188 项全部通过**（对照组，证明套件本身完好）。
  - 目标克隆：同命令 → **启动即崩溃**：`ENOENT: no such file or directory, open '.../target/Script/Script.js'`（Test/lib/loader.js:41）。目标仓的测试在自家仓库里跑不起来，根因是 2026-10-27 归档移动了被测文件而套件未同步。
  - 且 format_and_test.yaml 的 push 触发分支为 `['main']`，目标仓默认/工作分支为 `myclash-rules`——该 CI 在现行分支模型下**不会被 push 触发**（workflow_dispatch/PR 除外）。
- 结论：目标仓当前**没有任何可用的自动化测试**覆盖任何在用脚本；唯一活着的自动检查是 rules-canary（只探活远程依赖，不测脚本逻辑）。三件套的质量保证至今靠人工实测与巡检。

## 7. 章程重点审计点逐项回应

| 审计点 | 结论 | 证据 |
|---|---|---|
| 读现有值、缺失才补默认 | Go 线全面落实（§4）；custom 线不具备（上游无条件赋值） | E2 |
| undefined/null/false/0 区分 | Go 线三类判定各就其位，未见 falsy 误用（抽查范围见 §4） | E2 |
| 覆写是合并/替换/条件写入 | 三者并存且有明确边界：连接面=条件补默认、DNS 策略子项=合并、dns/proxies/groups/rules=全权替换、sniffer=条件全权 | E2 |
| 不同版本默认值不一致 | 1 处同名开关翻转（代理IPV4优先）；direct-nameserver 两线不同；规则源两线不同 | E4 |
| 重复/冲突的规则集键 | buildRuleProviders 以 `{...base}` + `Object.assign` 叠加服务 providers，同名键会静默覆盖——当前 serviceConfigs 内未见与 base 同名键（解析抽查），属潜在风险而非现行缺陷 | E2 |
| 过滤后组引用失效/空组 | filterAndNormalizeProxies 对空结果有专门分支；地区组按实际节点生成；合成实验（含信息节点、直连节点输入）未见悬空引用或运行期错误 | E4 |
| 节点未知字段破坏 | 未见白名单重建；展开复制保留字段 | E2 |
| 固定 CDN/单一规则源 | 规则集主源为单一仓库（bett-rules），分发通道因线而异（raw/jsdmirror）；图标主源为上游仓 jsdmirror；Geo 数据为 MetaCubeX 官方 fastly 源。单点清单见 dependency_inventory.csv | E4 |
| 注释宣称与实现落差 | 抽查的高影响注释（WebRTC 三件套、IPv6 缺口、tun stack 不设默认）均能在代码中找到对应实现或明确的缺口声明，未发现「注释有、代码无」 | E2 |
