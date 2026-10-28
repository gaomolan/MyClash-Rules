# WP-13 许可证、版权与第三方资产审查报告

- 工作包：WP-13（P0）｜角色：Security & Licensing Reviewer
- 审查日期：2026-10-28｜审查对象：`gaomolan/MyClash-Rules` @ `myclash-rules` 分支 HEAD `cc46de0`，及其全部第三方资产面（以 `01-baseline/dependency_inventory.csv` 的 URL 全量清点为边界）
- 方法：本地隔离克隆逐文件直读（目标仓 + 上游仓）+ GitHub API 直读各第三方仓库 LICENSE/README + 路径数据字节级比对。证据见 `evidence/wp13-sources.csv`（SRC-701 ~ SRC-720）与 `license_and_attribution_matrix.csv`（LIC-01 ~ LIC-20）
- 声明：本报告是工程审查，不是法律意见。凡标注「待确认/需专业法律意见」处，均不构成确定法律结论。

---

## 1. 结论摘要

1. **项目自身的许可地基是干净的**：上游 MyClash 以 MIT 发布，目标仓根 LICENSE 保留上游原文与 AIsouler 版权行未动（E4）。派生、修改、再分发在 MIT 下被明确允许，唯一实质义务是保留版权声明与许可声明。
2. **义务履行呈「仓库层达标、单文件层缺位」的分层状态**（详见 §2）：以 Git 仓库整体分发时义务已履行；但本项目的真实分发形态是**单文件订阅**，而三件套脚本文件内没有任何许可声明文本——这是全仓最大的许可敞口。
3. **全部 GPL-3.0 资产（bett-rules、AWAvenue、meta-rules-dat、666OS）目前都是 URL 远程引用、未复制进仓**，当前模式下 GPL 的分发义务不由本项目触发（E3，基于分发模式事实的判断）。红线是：一旦新仓改为**镜像/打包**这些规则或 Geo 数据，义务格局立刻翻转（见 §4）。
4. **两处「无许可依据」的引用**：`binaryu/emos-proxy-rule` 无 LICENSE 文件、README 无许可声明（E4）；`cn-additional-list.mrs`（353355.xyz）维护者与许可完全未查明（E1）。两者当前都被「仅引用不复制」限制住风险，但不适合在不知情的情况下带进公开新仓的默认配置。
5. **图标是许可状态最不透明的资产面**：自有 3 枚图标与 Simple Icons 路径数据逐字一致（E4），但 Simple Icons 官方明确声明「项目 CC0 ≠ 每个图标 CC0」（E4），逐图标许可本轮未能核实；且 CC0 不处理商标权。上游继承图标集逐项来源未标注，还存在 Qure 的非商用条款链（E3）。

## 2. 目标仓当前署名义务履行状况（核心问题）

义务来源：MIT 许可证要求「The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software」（SRC-701/702，E4）。

| 分发形态 | 现状 | 判定 | 证据 |
|---|---|---|---|
| 仓库整体分发 | 根目录 LICENSE 为上游 MIT 原文、版权人仍署 AIsouler；两份 README 均有「Forked from AIsouler/MyClash」明示 | **已履行** | E4（SRC-701/703） |
| 单文件分发（三件套脚本订阅） | 文件头仅一行「Forked from AIsouler/MyClash (URL)」；全文检索 `copyright`/`license` 零命中，无许可声明文本 | **未履行到位** | E4（SRC-704） |
| 单文件分发（custom 线） | 生成物内嵌上游脚本原文（含上游作者头），声明随原文保留 | 基本履行（附带） | E3（WP-1 字节级拼接验证 + SRC-705 链） |
| NOTICE 文件 | 仓内无 NOTICE；MIT 不要求 NOTICE | 不构成缺项 | E4（WP-1 文件树清点） |
| 上游致谢链 | 上游 README 致谢节（bett-rules、Qure、YaNet、YiXuanZX/rules、JSDMirror）在目标仓 README 精简时被删除，仅存 Forked 行 | 不违反 MIT 字面义务，但归属完整性弱于上游 | E4（SRC-703/717） |

**结论**：目标仓当前署名义务在仓库维度**成立**，在单文件维度**存在明确缺口**。缺口是否构成对 MIT 的实际违反，取决于「单个脚本文件是否构成 MIT 所称的 copy / substantial portion」这一法律解释问题，本报告不下确定结论（列入 §6 法律意见清单第 1 项）；但从工程处置看，在脚本文件头补入一行许可声明（如 `Licensed under the MIT License. Copyright (c) 2026 AIsouler; modifications by gaomolan. See LICENSE in the repository.` 并附仓库 LICENSE 链接）成本近乎为零，建议按从严标准在新仓发布前完成。

另注意：目标仓根 LICENSE 只有 AIsouler 的版权行、没有 gaomolan 自己的版权行。这不影响义务履行，但新仓若希望主张自有部分的版权，应在保留上游版权行的前提下并列追加自有版权行，而不是替换。

## 3. GPL-3.0 资产组（bett-rules / AWAvenue / meta-rules-dat / 666OS）

- 四者许可证均已直读确认为 GPL-3.0（E4：SRC-705/706/707/708）。
- 现行使用方式：脚本只写入 URL，客户端在运行时从源站/CDN 下载 `.mrs`/`.dat`/`.mmdb`。**文件从未进入目标仓**（WP-1 文件树可证），本项目不构成对这些文件的分发。
- 两个结构性事实需要在发布决策时知情：
  1. **bett-rules 被消费的 `meta` 分支上没有 LICENSE 文件**（根目录仅 asn/geo/geo-lite 三个目录，E4），许可证只存在于其默认分支。引用方感知不到许可存在——这不改变许可效力，但意味着下游用户无从知晓条款。
  2. **数据链是多层汇编**：meta-rules-dat 的 README 致谢链含 v2fly/domain-list-community、Loyalsoldier/geoip、blackmatrix7、gfwlist、EasyList 等 13 个来源，且文件清单含 `GeoLite2-ASN.mmdb`（MaxMind GeoLite2 数据链，其 EULA 另有署名与再分发限制，本轮未逐条核对，E2）；bett-rules 的 README 与 meta-rules-dat 同构、应属同源再加工（E3）。若将来做自有镜像，需要核对的是整条链、不是最外层一个 GPL。
- 对新仓的建议：**保持 URL 引用模式**，并在 README 的「第三方规则与数据来源」表中逐项标注来源与许可证（GPL-3.0），让使用者知情；不要把任何 `.mrs`/`.dat`/`.mmdb` 复制进新仓仓库或 Release 附件，除非先完成 §6 第 2 项的专项评估。

## 4. 图标资产组

### 4.1 自有三枚（Claude / GitHub / Cloudflare）

- 路径数据与 Simple Icons 现行文件逐字一致、品牌色一致（E4，SRC-714）——「Simple Icons 官方图形」这一来源表述**属实**。
- Simple Icons 项目以 CC0 1.0 发布（E4，SRC-712），但其 DISCLAIMER 明确：**项目 CC0 不代表每个图标都是 CC0，逐图标许可须查数据文件中的 license 字段**（E4，SRC-713）。本轮因 `_data/simple-icons.json` 体积过大、连接器未能返回内容，Claude/GitHub/Cloudflare 三枚的逐图标许可**未能核实**，状态记为「条款待确认」。
- 商标维度（与著作权独立）：三枚图形分别是 Anthropic、GitHub、Cloudflare 的品牌标识，CC0 只处理著作权、不授予商标权。本项目的使用方式是「在策略组图标位指示流量类别」，属指示性使用、未暗示背书，实践风险低；但 GitHub 等品牌方另有品牌使用规范，新仓公开发布前建议按 §6 第 3 项确认。
- 附带发现：`Cloudflare.svg` 与 `Cloudflare-v2.svg` **字节完全一致**（E4，SRC-715），「-v2」不是变体而是同文件的第二个名字，且被不同脚本分别引用——许可上无碍，维护上建议在新仓收敛为一个文件名。

### 4.2 上游继承图标集（38 png + svg 继承部分）

- 名义上随上游仓库以 MIT 发布（LIC-12），但逐项著作权状态没有任何标注：上游 README 自述「精心绘制」，其 AGENT.md 却记录了以 vtracer 描摹位图参考图的工作流，且 §5.15 倡导「有官方矢量时直接换稿」——即图标集是自绘、描摹、官方矢量替换的混合体（E4，SRC-716）。
- 上游 README 致谢明列 **Koolson/Qure**（E4，SRC-717）。Qure 无 LICENSE 文件，其 README 条款为：转载注明出处、图标仅供学习参考、**切勿商业用途或牟利**、版权归原作者（E3，SRC-718）。无法逐项证实哪些上游图标源自 Qure，但来源链的存在意味着：新仓若整套搬运图标，应恢复 Qure 署名并保持非商业定位；其条款的法律效力与对本项目的适用范围列入 §6 第 4 项。
- 品牌 LOGO 本身（Apple/Google/Netflix/Telegram 等）的商标问题与 LIC-12 相同：指示性使用、风险低、无授权明示。

### 4.3 AGENT.md 约定与现状的一致性

- AGENT.md §0/§6 规定：命名 PascalCase、**`Icons/png` 与 `Icons/svg` 同名一一对应**（文中自述 38 对）。目标仓现状是 38 png / 42 svg：`Icons/png/GitHub.png` 已被删除（svg 保留且换成 Simple Icons 版），又新增 3 个仅有 svg 的自有图标——**配对约定已不成立**，与 WP-1 的「图标配对破裂」发现互相印证（E4，SRC-716）。
- 且目标仓持有的 AGENT.md 本身是上游旧快照（自述对数与引用格式均已过期，见 WP-1）。这不是许可违规，而是规范文档与仓库现实双向脱节：新仓发布前应二选一——按现状修订约定（例如明示「基线图标保持配对、自有品牌图标仅 svg 例外」），或补齐/清理文件使配对恢复。不得带着一份自相矛盾的规范对外发布。

## 5. 无许可/未查明组

| 资产 | 状态 | 说明 |
|---|---|---|
| binaryu/emos-proxy-rule | **文件未找到**（E4） | 无 LICENSE、README 无许可声明；内容自述源自 emos wiki。在「无许可即保留全部权利」的缺省规则下，本项目目前仅 URL 引用、不复制，敞口有限；但它是全部脚本（含上游）的默认规则之一，发布前应取得作者许可、或替换数据源、或至少在来源表中明示其无许可状态供使用者知情 |
| cn-additional-list.mrs（353355.xyz） | **条款待确认**（E1） | 两次定向搜索未找到维护者与许可信息；该文件自上游起即被引用。溯源路径建议：查上游仓库提交历史与上游作者说明；溯源失败则按 LIC-09 建议替换或明示 |
| LightGBM Model.bin（vernesong/mihomo Release） | **条款待确认**（E3） | 项目级 GPL-3.0（体积指纹）；模型文件本身的许可与训练数据来源未见单独声明。仅旧 smart 线 URL 引用，Go 三件套不涉及，优先级低 |

## 6. 需专业法律意见事项清单

1. 单个脚本文件（内含上游实质代码）脱离仓库、以订阅 URL 形式分发时，MIT 的「copies or substantial portions」声明保留义务是否及于文件本身。
2. 若新仓镜像或打包分发 GPL-3.0 的规则/Geo 数据（`.mrs`/`.dat`/`.mmdb`），GPL 分发义务的具体范围；以及「脚本以 URL 指向 GPL 数据」是否在任何法域下构成衍生作品或组合分发。
3. 以品牌标识（Claude/GitHub/Cloudflare 及其余策略组图标）作为功能指示图标的商标指示性使用边界，及 GitHub 品牌规范对 Octocat 标记的具体限制。
4. Qure 的 README 非标准条款（注明出处、禁止商用）对经上游转手的图标是否具有可执行的约束力，及本项目「非商业开源推广」定位与其的兼容性。
5. MaxMind GeoLite2 数据（经 Loyalsoldier/geoip → meta-rules-dat/bett-rules 链）在镜像分发场景下的署名与再分发限制。
6. 无许可证的第三方规则（emos-proxy-rule、cn-additional-list）在缺省版权规则下被公开项目默认引用时的风险定级。

## 7. 发布前处理建议清单（按优先级）

**P0（发布前必须）**
- [ ] 三件套脚本文件头补入 MIT 许可声明行并指向仓库 LICENSE（§2）；新仓根 LICENSE 保留 AIsouler 版权行、并列追加自有版权行。
- [ ] 新仓 README 恢复完整致谢/来源表：上游 MyClash、bett-rules、AWAvenue、meta-rules-dat、666OS、emos-proxy-rule、Simple Icons、（经上游链的）Qure 与 YiXuanZX/rules 等，逐项标注许可证类型。
- [ ] 明确保留「规则与 Geo 数据只引用、不镜像」的发布红线，并写入新仓维护规范（§3）。
- [ ] emos-proxy-rule 与 cn-additional-list 二选一处置：取得许可/完成溯源，或替换数据源，或在来源表中明示无许可状态（§5）。

**P1（发布前应办）**
- [ ] 补核 Simple Icons 三枚图标的逐图标 license 字段（从 npm 包的 simple-icons 数据文件取），把 LIC-14/15/16 的状态从「待确认」落定。
- [ ] 图标规范与现状对齐：修订 AGENT.md 配对约定或补齐文件；`Cloudflare.svg`/`-v2` 收敛为单一文件名并同步脚本引用（§4.1/4.3）。
- [ ] 为上游继承图标补一份逐项来源登记（自绘/描摹/官方矢量/Qure 链），无法确证的标「来源未标注」。

**P2（发布后跟进）**
- [ ] 就 §6 清单择要咨询专业法律意见，结果回填本矩阵状态列。
- [ ] 在规则巡检（rules-canary）之外，为第三方资产增加「许可证文件存在性」年度复核项（上游改许可的先例在开源生态并不罕见）。

## 8. 本轮局限

- Simple Icons 逐图标 license 字段未取得（数据文件过大，连接器未返回内容）——已按章程规则降级为「条款待确认」，未以项目级 CC0 代替逐图标结论。
- vernesong/mihomo 的 LICENSE 仅以 35,149 字节体积指纹判读为 GPL-3.0（E3），未逐字复读头部。
- emos-proxy-rule 子目录未逐一打开核查许可文件（根级与 README 已确认无，E4 的覆盖范围如实标注于 SRC-709）。
- meta-rules-dat 数据链各上游（v2fly、Loyalsoldier、blackmatrix7、gfwlist、EasyList 等）自身许可未逐一核查；因当前为引用模式、优先级列入镜像场景的前置条件。
- 上游图标与 Qure 的逐项派生关系在技术上无法证实/证伪，按来源链提示处理，未作认定。
