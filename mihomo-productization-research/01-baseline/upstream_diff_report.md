# WP-1 上游差异报告 — gaomolan/MyClash-Rules ↔ AIsouler/MyClash

- 审计日期：2026-10-28（Asia/Taipei）
- 目标仓基线：`gaomolan/MyClash-Rules`，分支 `myclash-rules`（同时为默认分支），HEAD `cc46de02171345c90ffc05409d44b3658b52bf74`（2026-10-27，sync 生成提交「功能：移除 epicgames #63」）；仓库无 tag/release
- 上游基线：`AIsouler/MyClash`，分支 `main`，HEAD `071d4ec5764b4700d0c5de41797f20a8bdf6b6d8`（2026-10-26，「feat: 移除 epicgames #63」）
- 方法：两仓 `git clone --depth 50` 至隔离目录后做文件级字节比对、结构化解析（函数/开关/URL 提取）与合成输入运行实验。本地快照：`01-baseline/_work/target`、`01-baseline/_work/upstream`
- 证据等级标注：E4 = 本次实测/字节级验证；E2 = 源码直读

## 1. 仓库级差异（E4）

| 项 | 目标仓 | 上游 |
|---|---|---|
| 文件总数 | 122 | 110 |
| 总体积 | 1,869,623 B（约 1.87 MB） | — |
| 与上游同路径同内容 | **96 个文件逐字节相同** | — |
| 同路径已修改 | 9 个（见 §6） | — |
| 目标独有 | 17 个 | — |
| 上游独有 | — | 5 个（`Config/` 两件现行版、`Icons/png/GitHub.png`、`Script/` 两件现行版；目标仓对应物在 `archive/`） |

顶层构成（目标仓）：Icons 80、Test 12、Image 9、Script 7、archive 4、.github 3，其余为根文件。**结论：目标仓约 79% 的文件是上游原样继承**，自有产出集中在 `Script/`、两个自有 workflow 与 `tools/`。

## 2. custom 线：生成产物与上游的字节级关系（E4）

`Script/mihomoScript-custom.js`（主力机在用）经验证为确定性拼接产物：

```
首行注释（订阅地址，gaomolan 新名） + 上游 Script/mihomoScript.js@071d4ec 全文 + Script/customPatch.js 全文
```

三段拼接与仓库现文件**逐字节相等**。含义：

- custom 线与上游 HEAD 之间**零代码漂移**（截至基线时点）；其全部「自有行为」只来自 customPatch（107 行）。
- customPatch 的实现方式是包装上游 `main()`，并直接引用上游内部标识符 `rateRegionDefinitions`、`lowRateRegionName`、`urlTestBaseOption`、`iconBaseUrl`（customPatch.js:11-14、45）。这是**隐式耦合**：上游一旦重命名这些标识符，补丁将静默失效或抛错。
- sync 工作流的 Validate 步（sync-myclash.yml:102-103）只校验 customPatch 标志串与上游含 `function main(config)`，**不校验上述四个标识符是否存在**——耦合断裂不会被现有校验拦截（E2，源码直读）。
- 合成输入运行实验（10 个虚构节点）：custom 输出 = 上游全量版输出 + 1 个组（`香港-低倍率自动选择`，customPatch 追加），其余组/规则/规则集计数一致（42 组 / 58 规则 / 46 规则集，上游为 41/58/46）。

## 3. Go 线与上游全量版的结构级差异（E4/E2）

Go 主版（1988 行）与上游全量版（1761 行）diff 867 行。二者**共享同一函数骨架**（上游 18 个顶层函数中 17 个同名同序保留），Go 线是同一代码基的深度演进，不是重写：

| 维度 | 上游全量版 | Go 主版 | 证据 |
|---|---|---|---|
| 顶层函数 | 18 | 22（`buildFunctionalGroups` 拆为 `buildFunctionalContext`/`buildServiceGroups`/`buildServiceRules`/`buildRuleProviders` + 编排器） | 函数清单解析 |
| `main()` 铺底 | `const newConfig = {}` 从零构建，连接面字段**无条件赋值**（`mixed-port=7890`、`ipv6=true`、`mode='rule'`…，main 起于 L1677） | `const newConfig = {...config}` 铺底，连接面逐项 `=== undefined` 才补默认（main L1818 起；端口 0 语义有专门注释） | E2 源码对照 |
| 开关集（36 个，两边同数不同构） | 含 Crypto/EHentai/Line/Netflix/Patreon/PayPal/Spotify/Steam/极简模式/自动选择 | 删除上述 10 个；新增 Auto/Claude/Cloudflare/Financial/显示低·高倍率节点/IPv6总开关/WebRTC走代理/屏蔽STUN端口/启用Sniffer配置 | 开关集解析（E4） |
| 同名开关默认值差异 | `代理IPV4优先: false` | `代理IPV4优先: true`（唯一一处同名默认值翻转） | E4 |
| 策略组命名 | `自动选择`、`香港-自动选择`、`台湾`（归档旧版作`台湾省`） | `Auto`、`中国香港-Auto`、`中国香港-Eco-Auto`（低倍率组改称 Eco-Auto） | 运行实验组名清单 |
| 服务组构成 | 22 个服务组（含 Steam/Netflix 等 7 个已删组） | 20 个服务组：Claude 独立成组、Crypto+PayPal 等合并为 Financial、新增 Cloudflare 组 | 运行实验（E4） |
| 输出规模（同一合成输入） | 41 组 / 58 规则 / 46 规则集 | 37 组 / **96 规则** / 38 规则集（手写规则显著增多、规则集收敛） | 运行实验（E4） |
| bett-rules 规则源 | `https://cdn.jsdmirror.com/gh/appshubcc/bett-rules@meta/geo/`（L146） | `https://raw.githubusercontent.com/appshubcc/bett-rules/meta/geo/`（L228），ASN 基址由其派生 | E2 |
| direct-nameserver | `223.5.5.5`、`119.29.29.29`（明文 IP） | `119.29.29.29`、`114.114.114.114`（明文 IP）；DoH 上游（doh.pub/1.12.12.12/cloudflare-dns/dns.google）在两线一致 | 运行实验 + URL 提取 |
| 图标基址 | jsdmirror → 上游仓 `AIsouler/MyClash@main/Icons/svg/` | **同上游**（L225）；另有 3 个图标（Claude/GitHub/Cloudflare-v2）硬编码指向自有仓 jsDelivr 地址（L530/585/864） | E2 |
| 健康检查 URL | `https://www.apple.com/library/test/success.html` | 相同（groupBaseOption L402） | E2 |
| 文件头 | 作者/源仓库/脚本链接注释，无版本号 | `Clash-rules-go · v1.0.0-phase3`，含脚本地址+直连地址+Froked from 声明与设计原则 | E2 |

Go-smart 与 Go 主版 diff 仅 58 行（+5 个 Smart 开关、组型改 smart、GBM 参数）；combo 与 Go 主版 diff 144 行（+3 个 Spark 专属函数、开关集与主版完全一致）。**三件套内部漂移面小且可量化**（E4）。

## 4. 旧 Smart 线（mihomoScript-smart.js，测试机在用）（E4/E2）

- 1983 行，与上游现行全量版 diff 346 行；函数骨架含 `toMatchableName`（18 函数），**其派生基线比 archive/ 快照新**，但与上游现行版仍有 346 行差（无法在本报告内定位其确切上游 commit，见 §8）。
- 开关 42 个 = 上游 36 + 6 个 Smart 相关（Smart优先ASN/Smart低倍率优先/Smart启用GBM模型/Smart收集训练数据/日志级别调试/**防WebRTC泄露**）。注意其 WebRTC 防护是**单开关**设计，与 Go 线的双开关（WebRTC走代理+屏蔽STUN端口）是两套不同设计，跨线维护时不可直接互译。
- 运行实验显示其已并入低倍率补丁功能（多出 `香港-低倍率自动选择` 组、规则集 47 个，比上游多 1）——即旧 Smart 线 = 上游骨架 + Smart 改造 + customPatch 功能并入，三种来源叠加，是四条线里来源最杂的一条。

## 5. 规则集来源的在线漂移（E2/E4）

同一「bett-rules 换源」决策只落在 Go 三件套：现行在用脚本中，custom.js 与旧 smart 的 `ruleSetBaseUrl` 仍为 jsdmirror（前者由上游决定、后者派生时未跟进），Go 三件套为 raw 官方源。jsdmirror 曾在 2026-10-27 巡检中出现分钟级 403 抖动——即**主力机在用的 custom 线恰好仍暴露在该抖动源下**，而自有 Go 线已规避。此为「底板规矩」（以 Go 为底板）之外、生成线与自有线之间的实际行为差，应登记为已知漂移。

## 6. 同路径已修改的 9 个文件（E4）

| 文件 | 与上游差异 | 说明 |
|---|---|---|
| `AGENT.md` | 23 行 | 目标仓持有的是**上游旧快照**：文中图标引用格式仍为 fastly.jsdelivr、图标 38 对；上游现行版已改 jsdmirror、39 对。文档与现实双向脱节（见 §7） |
| `Icons/svg/GitHub.svg` | 内容不同 | 自有替换版（脚本硬编码引用自有仓此文件） |
| `README.md` | 内容不同 | 用户精简定稿版 |
| `Test/README.md` | 10 行 | 测试文档本地化 |
| `Test/lib/fixtures.js` | 50 行 | 测试夹具曾为自有线适配 |
| `Test/lib/loader.js` | 1 行 | — |
| `Test/lib/scripts.js` | 2 行 | 但**仍指向 `Script/Script.js` 与 `Script/mihomoScript.js`**（与上游相同） |
| `Test/suites/integration.js` | 131 行 | 曾做过本地适配 |
| `Test/suites/unit.js` | 77 行 | 同上 |

值得注意：Test 套件并非原样照搬——它被本地改过（共 261 行差异），但改动停留在旧两脚本时代；三件套从未被纳入。

## 7. 死代码、化石与文档脱节（E4）

- `archive/`（4 文件，约 186 KB）：上游旧世代快照（函数缺 `toMatchableName`、地区名仍用`台湾省`、图标基址为 fastly 时代、开关 36/19）。仅作历史留存，无任何现行引用（Test 指向的是 `Script/` 原路径而非 archive 路径）。
- `AGENT.md`（159,472 B，全仓最大文件）：上游的图标统一化手册，描述的对象（`Script/mihomoScript.js` 等路径、39 对图标）与目标仓现状（脚本已归档、图标 38 png/42 svg）均对不上；其内容对本仓现行维护无直接作用，且体积超过任一脚本文件。
- `Icons/` 配对破裂：上游为 39 png + 39 svg 一一对应；目标仓删了 `Icons/png/GitHub.png`（svg 保留并替换），又新增 3 个仅 svg 的自有图标——现为 38 png / 42 svg。脚本只引用 svg，运行无碍，但 AGENT.md 宣称的「同名一一对应」约定在本仓已不成立。
- `Image/`（9 个 webp，约 610 KB）与 `Rules/DownloadApps.txt`：上游原样继承，与现行三件套无引用关系（README 是否引用图片未逐一核对，标为未尽项）。
- `Config/` 已整体归档（目标仓无现行 YAML 配置），与上游仍维护 YAML 双配置的形态分叉。

## 8. 限制与未定位项

- 两仓克隆深度为 50：archive/ 两件快照对应的上游确切 commit、旧 Smart 线的派生基线 commit 未定位（其世代可由特征推断：介于 archive 世代与上游现行之间）。如需精确归属，需全量克隆后按内容哈希检索历史。
- 上游仓库除 main 外的分支/tag 未盘点（上游无 tag 输出，分支仅 main）。
- 本报告只做结构级与行为级（合成输入）比较；逐行语义 diff（867 行）未逐条归类，其功能级归纳见 `current_behavior_catalog.md`。
- 运行实验使用同一组合成节点（10 个虚构节点，含 1 个直连类型与信息节点）；组/规则计数随输入构成变化，跨变体比较有效，绝对值不代表真实订阅下的规模。

## 9. 结论摘要

1. 目标仓本质是「上游镜像 + 自有 Script 线」的双层结构：79% 文件为上游原样，真正的自有资产只有 Script 七件、两个 workflow 与巡检工具。
2. custom 线对上游是零漂移的生成关系，风险不在代码而在 customPatch 对上游内部标识符的隐式耦合与校验缺口。
3. Go 线与上游共享骨架但已形成独立的行为面（铺底哲学、开关集、组命名、规则构成、DNS 细节均不同），且三件套内部派生纪律良好（58/144 行可控差异）。
4. 实际在线漂移有两处：规则集来源（custom/旧 smart 仍走 jsdmirror）与 WebRTC 防护设计（旧 smart 单开关 vs Go 双开关）。
5. Test 体系在目标仓已失效（见 `current_behavior_catalog.md` §6 的实测），format_and_test.yaml 与上游逐字节相同且触发分支为 `main`，与默认分支 `myclash-rules` 不匹配。
