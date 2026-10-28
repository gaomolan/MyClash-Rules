# WP-8 代理组引用完整性实测报告（EXP-WP8-01）

- 实验 ID：EXP-WP8-01（配套：EXP-WP8-02 bundle 路径审计、EXP-WP8-03 即时探活，见 `07-validation/experiment_log.csv`）
- 日期：2026-10-28（CST）
- 结论先行：**全部通过场景中，悬空引用 0、空组 0、循环引用 0、孤儿规则集 0、重复名 0**。发现两类非错误级现象：①输入被过滤至空池时脚本显式抛错拒绝生成（fail-fast）；②单地区输入下 4 个组的 `default-selected` 指向未生成的地区组，按 wiki 语义静默回退首个成员。

## 1. 环境与方法

| 项 | 值 |
|---|---|
| 运行时 | Node.js v24.22.1（linux，vm 模块沙盒加载脚本后调用全局 `main(config)`，与 WP-1 run_variants.js 同一 harness 模式） |
| 被测文件 | `mihomoScriptGo.js`（sha256 前缀 `8a2cef4a7887`）、`mihomoScriptGo-smart.js`（`e445ca340700`）、`mihomoScriptGo-combo.js`（`e08eb2ae5dd8`），均取自目标仓 @cc46de0 隔离克隆 |
| 校验脚本 | `01-baseline/_work/wp8_integrity_check.js`（本 WP 新增，只读被测文件） |
| 输入 | 全部虚构节点：`ss` 类型、server 为 192.0.2.10（TEST-NET）/密码占位符；无真实订阅、无真实凭据 |
| 开关模拟 | S6 通过在加载前改写 `ruleOptionsEnable` 字面量默认值（true→false）模拟 Bettbox GUI 关组后的状态，其余场景用脚本默认开关 |

校验项（对每份输出程序化执行）：
1. 每条规则的目标（解析尾段；逻辑规则取最后 `),` 之后段；含 `no-resolve` 剥离）∈ 节点名 ∪ 组名 ∪ 内置名（DIRECT/REJECT/REJECT-DROP/PASS/COMPATIBLE/GLOBAL）。
2. 每条规则及 DNS 配置中出现的全部 `RULE-SET,<name>` / `rule-set:<name>` 引用 ∈ 输出 `rule-providers` 键集；反向检查无规则/DNS 引用的孤儿 provider。
3. 每个组的每个成员 ∈ 节点名 ∪ 组名 ∪ 内置名；组名/节点名无重复。
4. `default-selected` ∈ 该组自身成员列表（不在则记录为降级警告，依据 wiki「不存在时默认选择组中第一个节点」，SRC-803）。
5. `empty-fallback` 为节点名或内置名（wiki：仅支持 proxy 名，SRC-803）。
6. 节点 `dialer-proxy` 指向存在；组间引用 DFS 环检测。

## 2. 场景与结果

| 场景 | 输入规模 | 被测 | 输出规模（节点/组/规则/规则集） | 结果 |
|---|---|---|---|---|
| S1_full 全地区 | 14 节点（5 地区+高低倍率+链式 dialer-proxy+显式 udp:false+2 信息节点） | 三件套 | 17 / 42 / 96 / 38（三版一致） | ✅ 全绿 |
| S2_hk_only 单地区 | 3 个香港节点 | 三件套 | 8 / 29 / 96 / 38 | ⚠️ 4 条 default-selected 降级警告（见 §3.2），其余全绿 |
| S3_empty 空输入 | 0 节点 | 三件套 | —（抛错） | 显式抛错（见 §3.1） |
| S4_info_only 全信息节点 | 3 个信息节点（默认被「过滤非地区节点」剔除） | 三件套 | —（抛错） | 同 S3 |
| S5_spark_mix | 9 节点（[Spark] 港/新/美/日/英 + [吹雪] 日/美 + 普通港） | combo | 11 / 35 / 96 / 38 | ✅ 全绿；输入 9 → 输出节点 11 = 保留 6（Spark 港 1、新 2、吹雪 2、普通 1）+ 内置直连 5，非保留地区 Spark（美/日/英 3 个）已从配置剔除，Spark 专属组仅生成港/新，通用池无 Spark 泄漏（以计数与引用校验互证） |
| S6_svc_off 关组 | S1 输入 + 关 Claude/AI/Cloudflare/AdBlock | Go | 17 / 38 / 78 / 34 | ✅ 全绿：被关的 4 组、其 18 条规则、4 个 provider 同步消失，无任何残留引用 |
| S6b_svc_off | S5 输入 + 关 Claude/AI | combo | 11 / 33 / 81 / 36 | ✅ 全绿（Spark 组随 AI/Claude 关闭不再被其成员引用——AI/Claude 组本身已移除） |

注：S1 三件套输出规模完全一致，差异在组类型（smart 版地区 Auto 为 smart 型）与 combo 的成员构成，引用完整性结论一致。

## 3. 发现

### 3.1 空池 fail-fast（设计行为，非缺陷）
S3/S4 下 `main()` 在 `filterAndNormalizeProxies`（Go 主版 L1018，上游同位置 L927 同样存在）抛 `Error: 配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写`，**不产出残缺配置**。评价：比「生成一堆空组再靠 empty-fallback 兜底」更安全；代价是订阅节点被开关全部过滤（如误开过滤类开关）时整个覆写失败、客户端报错而非降级运行。此行为上游同源，非 Go 线引入。

### 3.2 default-selected 静默降级（S2，E4 + wiki E2）
输入仅香港节点时，地区组仅生成「中国香港」系，`defaultSelectedMap` 中写死的跨地区默认值落空：Claude→美国、AI→美国、TikTok→日本、Financial→日本，共 4 组。按 wiki（SRC-803）：default-selected 为空或所指不存在时，默认选组中第一个成员——本配置各组首个成员为「默认代理」，即这些组实际默认选中默认代理而非设计意图的地区。**不报错、不悬空，但设计意图对单地区/小机场订阅静默失效**。三件套一致。建议（不在本 WP 实施）：生成组时若 defaultSelected 不在成员内则剔除该字段或回退到已生成地区组中的第一个。

### 3.3 空组与 empty-fallback 的关系
全部通过场景中**没有任何组以空成员生成**：地区组按实际节点生成、Cloudflare 的 fixedMembers 会过滤未生成的地区组（buildServiceGroups L1223-1228）、服务组恒含「默认代理」等组引用。因此 `empty-fallback: REJECT`（全组统一）在现行生成逻辑下是纯防御层，正常路径永不触发；唯一能触发它的路径（节点池非空但某组被过滤成空）在本次场景矩阵中未构造出来。结论：该参数保留合理，但不应被当作引用完整性的主要防线——主要防线是生成逻辑本身，本次实测支持其有效性。

### 3.4 开关三联动一致性（S6，E4）
关组时「组 + 规则 + providers」由同一开关在三个构建函数中同步门控（buildServiceGroups/buildServiceRules/buildRuleProviders 均为 `=== false` 跳过），实测无一处残留：被关组名不出现在 GLOBAL 成员、任何规则目标、任何 provider 中。这验证了 2026-10-20「缺失默认开」门禁加固在关组方向的对称正确性。

## 4. 局限

- 本实验是**结构校验**，不是 mihomo 本体加载验证：未用 mihomo 二进制实际 parse 输出配置（环境无内核二进制，且章程禁止执行来源不明二进制）。mihomo 对个别字段的宽容/严格程度以 wiki 文本为准（SRC-803）。
- 输入规模为小/中合成集（≤14 节点）；大节点量（数百）下的重复名碰撞概率未测（属 WP-9 范围，其夹具已覆盖重名/改名冲突）。
- S6 的开关模拟采用源码默认值改写，与 Bettbox GUI 的 Object.assign 合并路径等价性基于 WP-10 的引擎行为结论（extract/evaluate 两段式），未在 Bettbox 实机复测。
- smart 版的 smart 组在官方主线内核不可用（WP-10 已确认），属内核前提问题、非引用完整性问题，本报告不计入缺陷。
