# WP-10 客户端与内核兼容性说明

- 工作包：WP-10（P0）｜研究日期：2026-10-28｜方式：只读源码/文档研究（GitHub API 直读 + 仓库自带文档），**未在任何客户端实机运行**；凡未实测者一律标「未验证」
- 证据等级约定：E2=官方/项目文档支持，E3=源码直读或多源交叉，E4=实测（本 WP 无 E4），E1=项目历史记录/单一线索
- 来源编号 SRC-3xx 对应 `evidence/wp10-sources.csv`

---

## 1. Bettbox（appshubcc/Bettbox，v1.19.7 / HEAD 1fb8806）

### 1.1 覆写执行模型（源码显示，E3，SRC-302/303）
Bettbox 的配置流水线是**三段式**，脚本只是第一段：

1. **脚本段**：外置 JS 在 Rust 插件 code_forge 中以 **QuickJS（rquickjs）** 执行，入口 `main(config)`。
   - 执行前两轮沙盒调用：`extract_options`（限额 2s / 32MB / 栈 512KB）只跑脚本顶层，提取全局变量 `ruleOptionsEnable`（开关表）、`serviceConfigs`（分组图标）、`Compatible_With_Bettbox.policyGroupOptions`（策略组开关名单）；
   - `evaluate`（限额 10s / 128MB / 栈 512KB）把用户在 GUI 里的开关选择序列化为 JSON，在调用 `main()` 前以 `Object.assign(ruleOptionsEnable, __custom)` **回注脚本全局变量**——即 GUI 开关不是后处理，而是改脚本的输入；
   - 引擎内做键名规范化：`rule` → `rules`，并保证 `proxy-providers` 至少为空对象。
2. **App patch 段**：脚本输出被解析为 mihomo RawConfig 后，Go 层 `applyPatch`（core/patch.go）按 App 设置逐项叠加（见 1.2）。
3. **内核段**：patch 后的配置交给内置 mihomo（core/Clash.Meta，vendored 的 MetaCubeX/mihomo）。

失败语义：脚本超时/超内存/语法与运行时错误均有分类（Syntax/Runtime/Timeout/OutOfMemory/Cancelled），与 CVR 的「失败即跳过」不同，Bettbox 脚本失败的处置路径（是否回退未覆写配置）本次未逐行核到 UI 层，列入未验证清单。

### 1.2 管理字段清单与冲突策略（源码显示，E3，SRC-302/304）
`applyPatch` 的 `PatchParams` 即 App 的接管面，脚本输出在这些字段上**后手落败**：

| 字段面 | App 行为 | 脚本能否赢 |
|---|---|---|
| general（mode/ports/log-level/ipv6 等顶层） | params.General 非空时整段 unmarshal 覆盖 | 不能（App 赢） |
| geox-url | App 参数整体替换 | 不能 |
| hosts | App 条目逐键写入 | 冲突键 App 赢 |
| dns | **仅当** `override-dns=true` 或脚本 DNS 未启用（enable=false）时，才以「内核默认 DNS + App dns 参数」整体替换；`overrideDns` 模型默认值 **false**（config.dart:505） | 默认能（脚本赢）；开「覆写 DNS」后不能 |
| dns 附加强制项 | 无论何路径：`FallbackFilter.GeoSite` 被清空；Android 下 `dns.listen` 的 `:53` 改 `:10053` | 不能 |
| ntp / sniffer / experimental | App 参数非空时先重置为内核默认值再整体替换（sniffer 是整体替换而非合并） | 不能 |
| tunnels | App tunnels **追加**到脚本 tunnels 之后 | 部分（共存） |
| rules | App 提供 prepend-rules（前置）/override-rules（可整表替换或前置合并）；disabled-groups 会删组并把指向被删组的规则目标改写为 PASS；GLOBAL 组被移除并由 select-global 逻辑接管 | 不能（规则面最终由 App 收口） |
| proxy-groups | node-exclude-filter 被合并进各组/各 provider 的 exclude-filter；health-check-timeout（非默认 5000 时）补写各组缺失的 timeout；tolerance 等做类型规范化 | 不能（App 后处理） |
| proxy-providers / rule-providers | http 型 provider 的 path 被 App 按 URL 的 md5 重写到 App 管理目录 | 不能 |

### 1.3 特有扩展：GUI 开关体系（文档+源码，E2/E3，SRC-301/303/304）
- 脚本首行声明 `const Compatible_With_Bettbox = { ruleOptionsEnable: true, policyGroupOptions: [...] }` 后，脚本内 `ruleOptionsEnable` 对象的键即成为 GUI 开关；`policyGroupOptions` 名单内的归「策略组」区，其余归「⚙️ 其他设置」。
- 开关值类型被模型钉死为 `Map<String, bool>`（common.dart:1155 `custom-options`）。
- **强制 true 语义**：脚本声明的开关默认值若不是布尔，UI 层按 `v is bool ? v : true` 强制转 true（scripts.dart:49）；用户未动过的键回退默认亦为 `?? true`。→ 脚本作者不能用非布尔值表达「默认关」，只能老老实实写 `false`。
- 图标可由脚本 `serviceConfigs` 的 `icon` 字段提供（extract 阶段收集）。

### 1.4 2026-10-16 源码审计结论复核（2026-10-28，当前 HEAD 1fb8806 / v1.19.7）
| 旧结论（E1 线索，SRC-313） | 本次复核 | 状态 |
|---|---|---|
| 覆写脚本输出做底、App patch 盖上去（general 段 App 赢） | patch.go `applyPatch` 先收脚本输出 RawConfig，再 `yaml.Unmarshal(params.General, raw)` | ✅ 仍成立（E3，SRC-302） |
| DNS 段：override-dns 默认关，关时脚本赢 | patchDns 条件 `params.OverrideDns \|\| !enabled` 才替换；config.dart:505 `@Default(false) bool overrideDns` | ✅ 仍成立（E3，SRC-302/304） |
| ruleOptionsEnable 非布尔值被强制转 true | scripts.dart:49 `options[k.toString()] = v is bool ? v : true;`，另有两处 `?? true` 缺省 | ✅ 仍成立（E3，SRC-304） |
| （旧审计附带）App「覆写 Sniffer」为整体替换 | patch.go：`raw.Sniffer = defaults.Sniffer` 后再 unmarshal App 参数 | ✅ 仍成立（E3，SRC-302） |

### 1.5 平台与限制（文档，E2，SRC-301/305）
Windows 8.1+/macOS 12+/Linux/Android 8.0+（含 Android TV、ARM64 原生与 Compatible 兼容构建）；GPL-3.0；源于 FlClash 的 Flutter 客户端。官方分支仅 dev/main/test，**无 smart 内核分支**。

---

## 2. Clash Verge Rev（clash-verge-rev/clash-verge-rev，v2.5.8）

### 2.1 覆写执行模型（源码显示，E3，SRC-306）
- 覆写单元挂在**订阅（Profile）**上，全局另有「全局扩展配置（Merge）/全局扩展脚本」作用于全部订阅。
- **Merge**：YAML 深度合并；**Script**：JS 以 **Boa** 引擎执行（src-tauri/src/enhance/script.rs），约定 `main(config)` 返回新 config；执行前配置键统一转小写（use_lowercase），脚本看到的是小写键视图。
- 资源限额：超时 5s、配置 JSON 上限 10MB、日志 1000 条/1MB、循环迭代 1e7。
- **失败语义（与 Bettbox 的重要差异）**：注释明言 "Never fails"——脚本异常/超时/超限时记录 exception 日志并**原样返回输入配置**，覆写失败不阻断启动，用户可能在不知情下运行未覆写配置。
- 脚本产出会与输入逐键比对生成 changed_keys 供 UI 展示变更。

### 2.2 管理字段与冲突（部分源码显示，E3；细则未验证）
CVR 的应用设置（verge 层：端口、TUN、系统代理、服务模式等）由应用持有并在运行时生效，与订阅配置分属两层。本次未逐项核对「设置层 vs Script 输出」对每个顶层字段的最终优先级（尤其 DNS 与端口），列入未验证清单——因此本项目脚本在 CVR 上涉及 App 设置的字段（mixed-port、tun、dns）应按「可能被应用层覆盖」保守处理，不得引用 Bettbox 的结论外推。

### 2.3 对同一脚本的已知行为差异
- 同一份 main(config) 脚本在 CVR 与 Bettbox 均可运行（约定同源），但：CVR 无 GUI 开关回注（ruleOptionsEnable/Compatible_With_Bettbox 声明在 CVR 无效，开关只能靠脚本内默认值或 Merge 文件）；CVR 脚本面对的是小写键配置；CVR 失败静默跳过，Bettbox 失败分类明确但后续处置未核。

---

## 3. 裸 Mihomo（MetaCubeX/mihomo，v1.19.33）— 兼容性基线

- 内核本体，**无覆写层**：配置即 YAML，字段语义以官方 Wiki 为准（E2）。凡「客户端赢/脚本赢」的讨论在此行不适用——脚本的产物最终都要落回这份 schema 被解析。
- 分支面：main / Alpha / Meta / Mitm / android-* / dev-* 等；**无 Smart 分支**；对 `lightgbm`、`smart`（outboundgroup 路径）的代码搜索均为 0 命中（E3，SRC-308）→ **官方主线不存在 smart 策略组**，写了 `type: smart` 的配置在官方内核上不可用（解析失败或未知类型，具体报错形态未实测，列未验证）。
- 软路由部署（裸内核 + 配置文件）时，全部「客户端接管」问题转化为「配置文件由谁生成」问题：生成器（脚本/面板）即唯一事实源。

---

## 4. OpenClash（vernesong/OpenClash，v0.48.002）

### 4.1 覆写执行模型（仓库自带指南，E2，SRC-310）
OpenClash **不运行 mihomo JS 覆写脚本**。其覆写体系（OpenWrt/LuCI 环境）：
- **覆写模块**：INI 三段文件（`[General]` / `[Overwrite]` / `[YAML]`），存于 `/etc/openclash/overwrite/<名称>`，可多模块、按 UCI order 排序、可远程拉取；
- **固定 Shell 覆写**：`/etc/openclash/custom/openclash_custom_overwrite.sh`，经 ruby.sh/YAML.rb 以 Ruby 操作 YAML；
- **执行时机**：仅在插件启动/重启（start_service）时两阶段执行——`[General]` 先写 UCI 影响 yml_change.sh 的生成；`[Overwrite]/[YAML]` 在 yml_change.sh、yml_rules_change.sh **之后**合并，可覆盖内置脚本与 LuCI 设置的全部输出（含硬编码项）；`reload` 不重跑覆写。

### 4.2 管理字段与冲突
优先级链：订阅原始配置 < yml_change.sh（LuCI 覆写设置生成） < 覆写模块/Shell 覆写。即在本生态里「最后的覆写者赢」，且覆写者是路由器管理员本人，与桌面客户端的 GUI 开关模型没有对应物。`[YAML]` 段支持操作符：`!` 强制覆盖、`+` 数组追加、`-` 数组删除、`*` 批量条件更新。

### 4.3 迁移含义
桌面端 main(config) 脚本迁往 OpenClash 必须**转写**为 [YAML] 段或 Shell/Ruby 逻辑：组装逻辑（正则筛节点、动态生成组）只能用 Shell 覆写实现，成本与可维护性和 JS 完全不同。OpenClash 状态页含 `smart_enable` 字段（E2，SRC-310），显示其支持选用 Smart 内核变体，但内核二进制来源与版本对应关系本次未深核。

---

## 5. Smart Core 现状（下游分支生态）

- **实现位置**：`lux5am/mihomo-smart`（社区 fork，18 stars）持有完整实现：`adapter/outboundgroup/smart.go`、`component/smart/lightgbm/`（collector 数据收集、lightgbm 推理、transform）、`component/updater/update_lgbm.go`（模型在线更新）（源码显示，E3，SRC-309）。
- **smart 组参数**（smart.go:64-68 的 group 标签）：`policy-priority`、`uselightgbm`、`collectdata`、`prefer-asn`。注意社区模板（如 echs-top/proxy）注释提及的 `type-priority`、`sticky-sessions`、`lgbm-auto-update` 等键与该 fork 当前源码标签并不完全同名，跨模板抄参数有静默失效风险（以源码标签为准；sticky-sessions 等是否存在于其他 fork 未逐一核，列未验证）。
- **发布状态（风险点）**：该 fork 仅 Alpha 单分支、唯一 Release 是 2025-09-17 的 Prerelease-Alpha，最近 push 2026-07-11；无正式版节奏。与官方主线 v1.19.33 的高频发布形成鲜明对比——**smart 能力的供应链成熟度远低于主线**。
- **Bettbox feat/smart-core 个人分支（KevinChen222）**：2026-10-28 检索其名下全部 6 个公开仓库，无 Bettbox fork；官方 Bettbox 分支亦无 smart 分支（E3 否定性证据，SRC-312/305）。该个人分支或为私有/已转移/已删除，**公开不可达**；其内核来源、与 lux5am fork 的关系、6 个 Smart GUI 开关的现状均**未验证**，不得以项目历史印象替代证据。

---

## 6. iOS 客户端（相邻生态，不适用）

Loon / Stash / Egern 等不运行 mihomo 内核、不消费 mihomo YAML，亦不支持 main(config) 覆写；它们各自的插件/模块体系（如 Loon .lpx）与本项目脚本零复用。仅在 iOS 选型课题中作相邻生态参照，不纳入兼容性结论（范围边界，任务书指定）。

---

## 7. 同一脚本跨客户端行为差异速查

| 维度 | Bettbox | Clash Verge Rev | 裸 mihomo | OpenClash |
|---|---|---|---|---|
| main(config) JS | ✅ QuickJS，10s/128MB | ✅ Boa，5s，失败静默跳过 | ❌ 无此层 | ❌ Shell/Ruby/INI 覆写 |
| GUI 开关回注脚本 | ✅ 独有（ruleOptionsEnable） | ❌ | ❌ | ❌（LuCI/UCI） |
| 脚本后还有覆盖层 | ✅ App patch（general/dns 条件/sniffer/rules/groups） | 应用设置层（细则未验证） | 无 | ✅ 覆写模块后置且最高优先级 |
| 配置键大小写 | 原始键（另有 rule→rules 规范化） | 脚本见到小写键 | 原始 | 原始 YAML |
| smart 组可用性 | 官方版 ❌（官方内核）；个人分支构建 ✅（未验证） | ❌（官方内核） | ❌ 主线无 | 可选 Smart 内核（smart_enable，细节未核） |

## 8. 未验证项清单（本 WP 明确未覆盖）
1. Bettbox 脚本执行失败时 UI 层最终处置（回退/报错/部分应用）——未逐行核到。
2. CVR 应用设置层与 Script 输出对 dns、mixed-port、tun、sniffer 等字段的逐项最终优先级——未核源码细则。
3. 官方主线内核加载 `type: smart` 配置时的确切行为（报错文本/是否整表拒绝）——未实测。
4. KevinChen222 feat/smart-core 分支的一切现状（公开不可达）。
5. lux5am/mihomo-smart 之外其他 smart fork（如客户端内置打包来源）与参数标签差异（sticky-sessions、lgbm-auto-update 等键的归属）。
6. OpenClash 所用 Smart 内核的二进制来源与版本对应关系。
7. Bettbox Compatible（老设备）构建与主构建在覆写引擎上是否一致。
8. 全部对象均未做实机运行验证（本 WP 定位为只读基线研究；实测项应由后续 WP/真实设备课题承接）。
