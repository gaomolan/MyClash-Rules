# R-010 裁决报告：empty-fallback 填策略组的跨内核语义（2026-10-28 实测）

- 性质：所有者 2026-10-28 批准的专项验证（DC-02 处置路线选定「兼容开关 + 实测验证」后执行）
- 证据等级：E4（真二进制加载实测）+ E3（双内核源码逐行比对）
- 实验资产：07-validation/_work_r010/（官方与 smart 二进制、四份测试配置、smart 源码克隆）
- 实验记录：experiment_log.csv 的 EXP-R010-01~03；来源 SRC-1404~1406

## 1. 问题回顾

官方 mihomo v1.19.33 源码 parser 对 empty-fallback 填策略组名有明确禁止（注释原文 "strictly forbidden to fill in a proxy group for empty-fallback"），但项目历史中在 Bettbox（smart 内核分支）实机观察到填组名可运行，两者冲突未裁决（R-010）。本次用真二进制把事实面钉死。

## 2. 实测矩阵（mihomo -t 配置加载测试，虚构节点）

| 配置 | 官方 v1.19.33 | smart Alpha（lux5am，alpha-smart-8d4c8c7） |
|---|---|---|
| 空组 + empty-fallback=REJECT | ✅ 通过 | ✅ 通过 |
| 空组 + empty-fallback=节点名 | ✅ 通过 | ✅ 通过 |
| 空组 + empty-fallback=策略组名 | ❌ 失败 | ❌ 失败 |
| 非空组 + empty-fallback=策略组名 | ❌ 失败 | 源码逐行相同，推定失败（未单独跑） |

失败报错（两内核完全一致）：`proxy group[N]: <组名>: empty fallback proxy '<组名>' not found`，且与组是否为空无关——这是解析期校验，配置整体加载失败。

## 3. 源码比对

lux5am/mihomo-smart（Alpha 分支 HEAD）adapter/outboundgroup/parser.go L74-82 与官方 v1.19.33 同段逻辑逐行一致：先在 proxyMap 中查名（组名不在其中→not found），再对 ProxyGroup 类型二次拦截（strictly forbidden 注释），报错文案相同。**公开 smart 分叉没有放宽这条限制。**

## 4. 裁决结论

1. **不是「官方禁、smart 放」**：官方与公开 smart 分叉在这一点上行为完全一致，组名回填在一切公开可得内核上都是加载期硬失败。
2. 此前 Bettbox 实机「填组名可运行」的观察**无法由公开 smart 源码解释**。剩余候选：①KevinChen222 的 feat/smart-core 私有构建带有额外补丁（公开不可达、不可验证，归 R-009 供应链不透明范畴）；②当时观察口径有误（实际加载的配置并非所见配置）。两者均无法在本项目内进一步证实/证伪，如实保留。
3. **现行三件套全部填 REJECT，合规、无现实风险**（与 WP-8/WP-14 结论一致，本次实测再次确认 REJECT 与节点名均为合法值）。
4. 对 DC-02「兼容开关」路线的实际含义：开关可以保留，但**不存在可合法切换到的组名回填模式**——在可验证范围内开关的「组名位」没有落点。未来若产品设计需要「组为空时整体移交另一组」，必须在脚本生成层实现（生成时判定成员为空并改写规则/默认指向），不得依赖 empty-fallback 填组名。

## 5. 风险状态变更

R-010 由「高/未裁决」变更为「已裁决」：事实面钉死，缓解措施更新为——产物 empty-fallback 只允许 REJECT/节点名/COMPATIBLE，由测试用例 TC-K-02 固化为常设校验；残余风险仅剩 KevinChen222 私有分支行为不可验证一项，并入 R-009 跟踪。
