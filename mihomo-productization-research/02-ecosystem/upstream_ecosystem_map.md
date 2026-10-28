# 上游生态图谱（WP-3）

> 研究日期：2026-10-28。标注约定：****=有仓库/API/issue 原文支撑（证据编号见 `evidence/wp3-sources.csv`，SRC-401 起）；****=issue/帖文中的用户观点；****=本包基于事实的分析判断，置信度随附。横向对比见同目录 `competitor_matrix.csv`，问题样本见 `community_issue_evidence.csv`。

## 1. 生态分层

```text
相邻服务层 1molchuan ECH DoH（托管解析服务） · Sub-Store（订阅管理） · 订阅转换（ACL4SSR 谱系）
分发层 GitHub raw · jsDelivr（含 testingcf 镜像） · 自营 CDN（ruleset.skk.moe / echs 多镜像） · Release 附件
脚本/模板层 AIsouler/MyClash ──fork──▶ dukangalex/HiClash
AIsouler/MyClash ──同步+补丁──▶ 我方 MyClash-Rules（gaomolan）
Aethersailor/COCR（OpenClash 模板线） · echs-top/proxy · YiXuanZX/rules
客户端层 Bettbox · Clash Verge Rev · FlClash · OpenClash · Stash/Loon/QuantumultX（规则消费方）
内核层 MetaCubeX/mihomo（官方） · vernesong/mihomo（smart 分支，LightGBM 模型分发）
数据基础设施层 v2fly/domain-list-community（源头社区数据）
├─▶ MetaCubeX/meta-rules-dat（官方构建：dat/mrs/mmdb）
├─▶ Loyalsoldier/v2ray-rules-dat（二次加工 + 人工干预清单）
├─▶ appshubcc/bett-rules（同构再分发，我方当前规则源；细节见 WP-1/WP-12）
blackmatrix7/ios_rule_script（独立自维护名单库，与官方 cn 名单交叉同源）
SukkaW/Surge（多上游搜集 + TS 构建，自营分发）
```

## 2. 上游—派生关系（事实为主）

- **MyClash → HiClash**：GitHub 标记为 fork（2026-09-21），LICENSE 为 MIT 双版权（保留 AIsouler 署名），README 致谢置顶原项目。是本生态中署名与衍生关系处理最规范的样本（SRC-403/404）。
- **MyClash → 我方**：非 GitHub fork 关系，而是「定时同步上游脚本 + customPatch 补丁 + 自研三件套并行」的混合谱系；耦合点见 §3。
- **ACL4SSR → COCR**：COCR 自述基于 ACL4SSR 订阅转换模板魔改（SRC-406），其产品形态（ini 转换 + proxy-providers）源于该谱系，与脚本覆写线平行发展。
- **v2fly/domain-list-community → 数据层全体**：meta-rules-dat 与 Loyalsoldier 均以其为主要源头；bett-rules 的目录结构（geosite/geoip 的.mrs 按分类）与 meta-rules-dat 的 meta 分支同构。
- **blackmatrix7 ↔ meta-rules-dat 名单交叉**：issue #1749 中报告者交叉核对确认同一域名同时存在于 blackmatrix7 ChinaMax 原始名单与 MetaCubeX 生成的 cn.list——两条数据线存在同源/互相吸收关系，引用统计时不可重复计数（SRC-413）。
- **脚本层互相引用**：HiClash 致谢名单含 YiXuanZX/rules；echs 的 Smart 模型依赖 vernesong/mihomo 的 releases 分发；Sukka 的构建产物另有第三方转换器生态（如 Paxxs/clash-skk 将其文本规则转 mihomo rule-provider）。
- **SukkaLab/ruleset 的定性**：任务线索中的「SukkaLab/ruleset」经核实不存在为源仓库；源仓为 SukkaW/Surge，SukkaLab/ruleset.skk.moe 是其构建产物的同步/镜像仓（另有 GitLab 镜像）（SRC-410）。

## 3. 我方所处位置与耦合点

我方（gaomolan/MyClash-Rules，Clash-rules-go 三件套）位于**脚本层**，与 HiClash 同为 MyClash 的下游。主要耦合点：

| 耦合点 | 对象 | 性质 | 备注 |
|---|---|---|---|
| 脚本谱系 | AIsouler/MyClash | 同步线每 4 小时拉上游脚本生成 custom.js（WP-1 已证） | 已改精选集成政策，但自动同步仍在跑（风险见 WP-1 R-005） |
| 规则数据 | appshubcc/bett-rules（单源，raw 直连） | 34 个规则集 | 其上游与 meta-rules-dat 同构；官方源可作第二源候选 |
| 规则数据（对照） | MetaCubeX/meta-rules-dat | 未直接引用 | HiClash 已全量迁入；其 geosite:anthropic 已吸收我方手写的 Claude 域名大部 |
| 图标资产 | 上游 MyClash 图标库 + 仓库自有 Claude.svg 等 | 脚本运行时引用 | 旧仓转私有时自有图标 URL 失效问题见 WP-1 R-004 |
| 内核/客户端 | mihomo + Bettbox（含 smart 分支客户端） | 开关体系 ruleOptionsEnable 源自上游约定，GUI 呈现由 Bettbox 接管 | 客户端接管边界见 WP-10 |
| 分发 | GitHub raw / jsDelivr | 脚本与规则双通道 | jsDelivr 对大仓库有 50MB 包体上限（2026-10-27 实测，WP-1 记录） |
| 相邻服务 | 1molchuan DoH | 无耦合 | 场景互补，曾评估不接入（结论见 §5 第 11 条） |

## 4. 分层观察

- **许可证地貌分层**：脚本层以 MIT 为主（MyClash/HiClash）；模板层 COCR 为 CC BY-SA 4.0（内容许可）；数据层以 GPL 系为主（blackmatrix7 GPL-2.0、meta-rules-dat 与 Loyalsoldier GPL-3.0、Sukka AGPL-3.0 附个别 CC 例外）。越靠近数据层，许可越「重」——产品化时「借鉴思想」与「复制内容」的边界必须逐层区分（终审归 WP-13）。
- **工程化梯度**：脚本层内部梯度明显——HiClash 已具备 shared 单源生成 + golden 快照 + 真实内核校验 + 规则金丝雀的完整质量链；COCR 以 10 条 workflow 的生成/治理流水线见长；其余个人项目多为「自动更新 bot + 无测试」。工程化而非功能数，是当前生态的稀缺项。
- **规则官方化趋势**：HiClash 在 2026-10 月把规则源从第三方镜像整体迁往 meta-rules-dat 官方 MRS，并按「官方没有发布的 IP 集就去掉」原则瘦身；其 Claude 分组亦改用官方 geosite:anthropic、仅保留手写补漏（SRC-419）。官方集的分类粒度正在持续吸收社区脚本的手工劳动。
- **Issues 运营模式分化**：MyClash 维护者当日清零（open 恒为 0）；blackmatrix7 以模板 + 次日构建节奏承接 104 条 open；Sukka 与 HiClash 直接不用 Issues（前者明示不提供技术支持）；COCR 的 issue 区被 Renovate 依赖仪表盘占据、用户提报走模板。支持模式是产品化前必须先选的运营决策，而非上线后再补。
- **问题类别的跨项目一致性**：规则误杀/归属/时效在 blackmatrix7、meta-rules-dat、Loyalsoldier 三家数据项目中同构出现；分组归属争议与节点识别误判在 MyClash 的 issue 中占主导。详见 `community_issue_evidence.csv`（含样本偏差声明）。

## 5. 机会 / 风险 / 待验证假设（≥10 条）

1. **双版本防漂移已有现成工程范本。** HiClash 用 `Script/shared/` 单源块 + `sync-shared.js` 同步进双脚本、并以漂移检查测试兜底，同时保持单文件分发形态——直接回应我方 WP-5 的方案 B/D 与 R-003 漂移风险，且不要求改变用户导入习惯。（SRC-403）
2. **规则源官方化可降低单点风险。** HiClash 已证明全量迁 meta-rules-dat 官方 MRS 可行；我方仍押 bett-rules 单源（WP-1 R-002），可将官方源列为第二源/替代源正式评估，迁移成本主要在分类名对齐与 IP 集取舍。（SRC-403/411/419）
3. **官方数据层亦有产物完整性事故。** meta-rules-dat 发布包曾含 10 个 0 字节.mrs，引用方静默加载空集（#182，附 sha256 与复现）。任何单一规则源都需要「内容基线」级巡检，而非仅探活；我方 rules-canary 目前只做可达性检查。（SRC-414）
4. **规则误杀是全生态第一大运营成本。** 广告名单误杀微软登录（blackmatrix7 #1340)、cn 名单误收 PT 站与泄漏检测站（#185/#1749/#1750）均为实证。我方「广告完整版拉满」策略需在产品定义中预置误杀反馈与快速豁免机制，否则推广后支持成本集中于此。（SRC-413/414）
5. **AI 分类时效缺口是可防御的差异化点。** 新 AI 工具域名遗漏同时出现在官方源（#184）与 Loyalsoldier(#504)；我方 AI 组的手工补缺口若清单化维护并周期性与官方 category-ai 对账，可形成「补缺口资产」，而非散落在脚本里的手写行。（SRC-414/416）
6. **默认分组归属争议不可避免且持续。** Epic、HuggingFace、Gemini 三例均在 MyClash 以 issue 形式要求改默认归属，其中 Epic 直接引发上游改码。产品化需提供低成本的单域名/单服务改道机制，把争议从「改默认值」降级为「用户自助调整」。（SRC-415）
7. **节点识别误判是脚本类项目的高频故障源。** MyClash #58（倍率过滤失效）、#56（精简版漏识别整区节点）与我方历史上的倍率正则边界事故同型。识别逻辑必须夹具化回归（WP-9/WP-14)，HiClash 的 perf-guard(500 节点）与 golden 快照可作质量基线参照。（SRC-403/415）
8. **生成流水线与分发治理可借鉴 COCR 的分工。** 单一数据源多格式生成、purge-jsdelivr 自动清缓存、Renovate 依赖治理、mkdocs 文档站，构成配置类项目的工程化上限样本；但其内容为 CC BY-SA 4.0，只能借鉴结构与思想，不能复制规则/文档内容。（SRC-405/406）
9. **数据层 GPL/AGPL 与脚本层 MIT 的许可断层。** 若产品化过程中「参考」数据层项目的规则文本或代码片段，GPL-2.0/GPL-3.0/AGPL-3.0 与 CC BY-SA 的义务各不相同；本条仅陈述许可分布事实，具体合规结论归 WP-13 终审，不得据本包直接发布衍生内容。（SRC-402/404/405/409/410/411/412）
10. **「官方瘦身低误杀」与「完整版拉满」何者更适合目标用户，尚无对照数据。** HiClash 选前者（广告改 category-ads-all 并明示拦截面更小），我方既定偏好为后者。需在 WP-4/WP-11 中把拦截面与误杀率做成可测指标后再下结论，本包不预判。
11. **相邻服务层提示了「无代理场景」的真实需求。** 1molchuan 的 ECH DoH 以个人服务形态验证了该场景的机制可行性（实测印证，SRC-417/418)；其 /plus 中继与分流代理客户端互相冲突的自陈，也划清了与我方形态的边界。我方若扩场景，合理形态是「脚本 + 配套解析指引」而非自营服务——自营的信任、续航与出口风控成本在该案中暴露得很清楚。
12. **分发链脆弱性被多个项目以工程手段反复确认。** COCR 专设 purge-jsdelivr workflow(11KB)，我方亦实测过 jsDelivr 的 50MB 包体上限与镜像 403 抖动（WP-1 记录）。产品化需双通道分发与缓存失效预案，不能把「raw/jsDelivr 二选一」当作冗余设计。
13. **个人项目的「无 Issues」模式在推广后不可持续。** Sukka（明示无支持）与 HiClash（未启用 Issues）在小用户量下成立；MyClash 在千级 Star 后即出现当日必清的 issue 流。推广规模与支持模式的对应关系需在 WP-4/WP-16 中按用户量分档设计，本包样本不足以给出阈值。

## 6. 本包覆盖不足

- 论坛（linux.do 等）证据按分工仅登记占位行，待协调者以已存登录补采后回填 `community_issue_evidence.csv` 并升级证据等级。
- echs-top/proxy 与 YiXuanZX/rules 的 LICENSE 未读取，矩阵中标「未核实」；两仓的名单/脚本细节以 2026-10-27 笔记（E1）为线索，未逐行复核。
- meta-rules-dat 与 Loyalsoldier 的数据发布节奏（release 分支/Release 附件频率）未逐条核对，活跃度以主分支提交 + workflow 存在性表述，已在矩阵中注明。
- COCR 的历史 issue 以名单提报为主这一判断来自其 issue 模板与笔记记录（E1/E2)，未逐条抽样历史 closed issue。
- 客户端/内核矩阵（client_kernel_matrix.csv）按项目分工由 WP-10 承接，本包未重复制作。
