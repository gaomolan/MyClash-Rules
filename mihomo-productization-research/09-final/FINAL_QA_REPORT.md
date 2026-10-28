# 交付质量报告（FINAL_QA_REPORT · 自查版）

- 日期：2026-10-28｜性质：终报撰写方的**自查**报告。章程 §12 的结项评分与 §13 的结项判定由 WP-17 独立审查执行，本报告不给自己打分、不宣布结项；凡自查不能独立确认的事项，均明确标为「待 WP-17 复核」。
- 自查方法：逐目录文件清点、登记册程序化校验（列数/行数/分布统计）、关键数字跨文件比对、章程 §0.0.1 清单逐项对照。

---

## 1. 交付物清单与完整性自查

本地执行区文件清点（不含 `_work/` 隔离实验区与基线克隆）：

| 目录 | 文件数 | 主要交付物 | 完整性 |
|---|---|---|---|
| 00-management | 12 | 章程、WBS、任务/风险/问题/决策/变更/状态/门禁/依赖图、Drive 验证记录 | 齐全；状态报告与门禁勾选的时点滞后见 §4-3 |
| 01-baseline | 5 | repository_inventory.csv、script_variant_matrix.csv、upstream_diff_report.md、current_behavior_catalog.md、dependency_inventory.csv | 齐全，与 WP-1 验收口径一致 |
| 02-ecosystem | 4 | competitor_matrix.csv（10 项目）、upstream_ecosystem_map.md、community_issue_evidence.csv、client_kernel_matrix.csv | 齐全；论坛覆盖限制已在文件内登记 |
| 03-technical-research | 9 | mihomo_config_semantics、dns_fakeip、ipv6_udp_webrtc_quic、rules_priority_and_providers、group_reference_integrity、proxy_node_normalization、client_compatibility、performance_and_resource_cost、regex_coverage_matrix.csv | 齐全 |
| 04-security-licensing | 6 | threat_model、supply_chain_review、secret_handling_review、external_dependency_risk.csv（34 条）、license_review、license_and_attribution_matrix.csv（20 项） | 齐全 |
| 05-product-definition | 4 | user_segments_and_jobs、feature_inventory.csv（36 项）、feature_value_risk_matrix.csv、lite_full_boundary_options | 齐全 |
| 06-architecture | 7 | target_architecture、route_comparison、migration_risks、ADR-001~004 | 齐全 |
| 07-validation | 20 | test_strategy、test_case_catalog.csv（85 条）、compatibility_test_matrix.csv（18 行）、validation_gaps、experiment_log.csv（24 条）、test_fixtures（WP-9 夹具组）、prototypes（3 个原型/4 个脚本 + 6 份原始输出） | 齐全 |
| 08-roadmap | 3 | implementation_roadmap、next_phase_backlog.csv（51 条）、decision_checklist（DC-01~12） | 齐全；命名映射见 §4-1 |
| 09-final | 7 | 本报告组七份 | 本文件落盘后齐全 |
| evidence | 17 | SOURCE_REGISTER.csv（198 条）+ 各 WP 分表 15 份 + wp-final-sources.csv（30 条） | 齐全 |

任务台账自查：WP-0~WP-16 共 17 个工作包状态均为 DONE 且 notes 含协调者验收语；WP-17 为 NOT_STARTED（终报后执行，符合章程顺序）。全部 DONE 项均有对应交付物文件存在（逐目录核对通过）。

## 2. 来源登记统计

- 来源总登记 198 条（SRC-001 起，含各 WP 分表合并）；终报组新增登记 30 条（SRC-1201~1230，evidence/wp-final-sources.csv），合并后总登记 228 条。合并动作由协调者在 WP-17 前执行，本报告按合并前口径（198）统计、按合并后口径引用终报来源。
- 证据等级分布（按 evidence_level 字段首个等级标记归一化统计）：E4 73 条（37%）、E3 53 条（27%）、E2 42 条（21%）、E1 7 条（4%）、复合或自由文本标注 23 条（12%）——复合标注逐条口径以原文为准（如「E4（生成级）/E2（推导）」），归一化统计仅用于分布概览，不改变任何单条结论的等级。
- 实验登记 24 条（experiment_log.csv），全部为配置生成级；运行时实验 0 条——与 GAP-01 的披露一致，无以生成级冒充运行时的记录。
- 关键数字跨文件一致性抽查（自查通过）：122 文件/96 相同/79%（WP-1 与 ADR-002 引用一致）；差 58/144 行（WP-1 与 ADR-001 一致）；36 开关（WP-1/WP-14 原型/WP-5 一致）；38 规则集与 A-/B/B-/C 分级（WP-8 与 ADR-003 一致）；bundle 命中 33/38、缺失 5 集名单（WP-8 两处记载一致）；85 用例与 P0 46（WP-14 策略与目录程序计数一致）；51 条 Backlog 与分阶段计数（WP-16 CSV 程序计数：4/15/10/9/7/6，与路线图总览表一致）；DC-01~12 分层 2/6/4（decision_checklist 汇总表与正文一致）。

## 3. 章程 §0.0.1 最终验收清单逐项自查

| # | 清单项 | 自查结果 |
|---|---|---|
| 1 | Drive 目标根目录存在且链接可供用户访问 | 通过（协调者记录：根目录 + 10 个子目录已建，ID 在案，见 STATUS 与 Drive 根 README 映射） |
| 2 | README、管理台账、已完成工作包交付物与最终报告均实际存在于 Drive | WP-0~WP-16 交付物与各登记册：通过（每 WP 按「先落盘后置 DONE」同步并逐批验证返回）；**本报告组（09-final）于本文件撰写时仅落盘本地，Drive 同步待协调者在本报告组完成后执行——此项就终报部分标为待同步，须 WP-17 复核** |
| 3 | 台账中每个 DONE 项都有可打开的成果链接 | 部分通过：DONE 项与 Drive 文件的对应关系由目录映射 + 文件名规则建立，非逐项超链接形式；逐项可打开性抽查属 WP-17 复核范围 |
| 4 | 抽查至少 5 个不同目录文件可读取且非空 | WP-0 阶段已完成 Drive 创建/读取/更新三步验证（drive-access-and-storage.md）；终局跨目录抽查待 WP-17 执行（本自查已在本地对全部目录完成文件存在与非空清点） |
| 5 | 关键报告中的引用、证据编号、任务 ID 与文件路径相互对应 | 通过（自查范围：终报组全部 SRC/WP/R/DC/BL/GAP 编号均回指存在的登记册行或文件；§2 的跨文件数字抽查无冲突） |
| 6 | 最近一次保存时间、未同步文件清单与剩余阻塞项已记录 | 剩余阻塞项：无 BLK 级阻塞；非阻塞问题 ISSUE-001~003 在册。未同步文件清单：09-final 七份（待协调者同步）。最近保存时间以协调者终局状态报告为准 |
| 7 | 不存在明文密钥、Token、节点密码、未脱敏订阅凭据 | 通过：全部实验使用虚构节点（RFC 5737 文档网段）、虚构域名（*.example.test）与占位密码；WP-12 已做全量脱敏扫描且未发现真实凭据；combo 的个人命名属使用习惯类信息、已按敏感定性登记（T-06），其文件仅存于原仓库与本地基线克隆，不进公开候选集 |
| 8 | 最终状态明确区分 COMPLETED_IN_DRIVE / PARTIAL / BLOCKED | 本自查口径：研究交付物为 **COMPLETED（本地）+ Drive 同步待终局确认**；项目整体状态在 WP-17 独立审计与终局 Drive 门禁完成前**不宣称 COMPLETED_IN_DRIVE**。已知 PARTIAL 性质的覆盖面：论坛证据（ISSUE-003）、运行时验证（GAP-01，未验证而非未交付） |

## 4. 已知偏差与限制（自查发现，全部如实披露）

1. **WP-16 交付物命名映射（D-007）**：章程 WP-16 原列四件（implementation_epics.md / task_backlog.csv / dependency_critical_path.md / effort_estimates.md），实际交付三件（implementation_roadmap.md 含阶段划分、关键路径与估算口径专节 / next_phase_backlog.csv / decision_checklist.md）。内容覆盖无缺失，仅文件名与分件方式不同；映射已记入决策日志 D-007，WP-17 应按映射核对、不记缺失。
2. **WP-15 与 WP-14 的时间差**：WP-15 交付回报中标注其撰写时 WP-14 刚完成、涉及测试基建的时序判断以「WP-14 交付后复核」为前提。终报组撰写时已按 WP-14 定稿（85 用例、五期顺序、GAP 清单）逐项比对 WP-15/16 的相关引用，未发现冲突；该前提标注属诚实披露，不构成结论偏差。
3. **管理文件时点滞后**：STATUS_REPORT.md 仍为 #1（2026-10-28 00:50，Sprint 0 时点），QUALITY_GATE_CHECKLIST.md 的 G1~G6 勾选未随各 WP 验收更新。两者的内容缺口由 TASK_REGISTER 的逐项验收语与本报告组的综合承担；终局状态报告更新与门禁勾选补记为协调者的收尾动作，WP-17 应核对其完成情况。本自查对 G1~G6 的对应关系为：G1（WP-1 交付齐全）、G2（竞品 10 ≥ 8、功能价值矩阵完成）、G3（WP-2/6/7/10 均有源码级或实测证据，未验证项已编号登记）、G4（WP-12/13 完成且高风险均有处理建议）、G5（WP-5 五方案比较、WP-15 代码 4 路线 + 拓扑 4 路线比较）、G6（WP-14 策略可执行且原型实跑、WP-16 Backlog 逐条含验收标准）——均有交付物支撑；G7 待 WP-17。
4. **台账列位小瑕疵**：TASK_REGISTER.csv 全部 18 行均为 22 列（结构无破损），但 WP-4/6/7/9/11/16/17 行的 estimate_confidence 列残留种子期的「未审」字样（review_status 列本身均为正确的「协调者已审」，WP-17 行为「未审」属实）。不影响状态与验收结论的可读性，建议 WP-17 复核时顺手统一该列。
5. **估算类数字的性质**：轻量档首启下载约 780 KiB 为按集数比例估算（非逐集实测，WP-5 已标注、终报引用时保留估算口径）；路线图 13–21 周为低置信度量级估算；WP-11 性能数字含共享沙箱噪声、只取量级——三处均在原文与终报中显式标注，未被用作承诺数字。
6. **证据代表性的固有边界**：来源中 E1 仅 7 条但其中两处影响面不小——社区频率判断（WP-3/4 已按有据/推定分列）与 provider 故障语义推论（WP-8 U-1，待故障注��升级）。终报凡引用这两处均保留其等级标注。
7. **未在本自查范围**：Drive 端文件的逐项内容与本地版本的一致性终局校验、§12 九维度评分、强断言反向审查（把终报每条强结论回溯到证据原文）——均为 WP-17 的独立职责，本报告不预做结论。

## 5. 章程 §12 评分维度就绪度自查（非评分）

| 维度（权重） | 自查就绪情况（证据所在） |
|---|---|
| 现状基线准确性（15） | 双克隆逐字节比对 + 行为目录 + 基线锚点（cc46de0/071d4ec）在册 |
| 证据可追溯性（15） | 198+30 条来源登记、24 条实验登记、终报结论逐条标等级与出处 |
| 技术深度（15） | 官方源码语义卡 + DNS/IPv6/规则/识别四专题定稿，含生成级实测矩阵 |
| 生态与需求研究（10） | 10 项目 × 17 维度 + 36 项功能价值矩阵；论坛覆盖受限已披露 |
| 安全与许可证（10） | T-01~T-11 威胁模型 + 34 条依赖登记 + 20 项许可证矩阵；高风险均有处置路径 |
| 架构决策质量（15） | 两层路线比较含否决理由与敏感性分析 + 4 份 ADR + 迁移风险与一票否决点 |
| 测试与验证方案（10） | 12 层策略 + 85 用例 + 3 原型实跑；运行时缺口如实登记（GAP-01） |
| 项目管理完整性（5） | 六本登记册持续维护；时点滞后两处已在 §4-3 披露 |
| 交付物一致性（5） | §2 跨文件数字抽查无冲突；命名映射 D-007 在册 |

结项门槛（总分 ≥85、四项核心维度 ≥70%、无未披露的严重安全/许可风险、无伪造结果或未标注推测）是否达成，**由 WP-17 独立审查判定**；本自查未发现伪造测试结果、虚构来源或未标注的关键推测——全部未验证项均以 E0/GAP/U 编号显式登记，是本报告组可自证的底线。

## 6. 给 WP-17 的复核入口清单

1. 09-final 七份与 Drive 同步状态及逐项内容一致性；
2. §0.0.1 清单第 2/3/4 项的终局确认（本报告标为待同步/待抽查处）；
3. 强断言回溯抽样：EXECUTIVE Top 10 与 TECHNICAL_FINDINGS §5 缺陷清单逐条回指原文；
4. 台账 estimate_confidence 列位统一情况与 STATUS_REPORT 终局版；
5. WP-16 命名映射（D-007）按图核对，不记缺失；
6. §12 评分与结项判定（含 REWORK 清单，如适用）。
