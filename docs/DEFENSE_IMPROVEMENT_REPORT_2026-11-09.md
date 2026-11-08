# MyClash 遥测与隐私防护改进报告

- 审计日期：2026-11-09
- 基线：`myclash-rules` / `f88ff6d2bcc4369db7c3d998bceba0b6c2ff5c4f`
- 实施分支：`feat/defense-hardening-20261109`

## 一、详细盘点

| 位置 | 盘点结果 | 风险判断 |
|---|---|---|
| `Script/mihomoScriptGo.js` | 只有 AWAvenue 通用广告 provider；SystemHelper 已有进程、域名、端口规则 | 防线不完整，进程规则顺序不正确 |
| `Script/variant-layers/combo.json` | 额外包含 AdRules、Native Vivo/Huawei、BanProgramAD、例外名单和定点规则 | 通用防护逻辑仅在 Combo，版本能力分叉 |
| `Script/mihomoScriptGo-combo.js` | 生成物未包含 Go 主脚本中的 SystemHelper 规则 | 已提交产物与源代码脱节 |
| `Script/build-variants.js` | 精确锚点失效会停止生成 | 设计正确，但 Combo 层旧开关锚点已过期 |
| `Test/lib/scripts.js` | 仍登记已不存在的 `Script.js` 与 `mihomoScript.js` | 旧通用测试入口本身已失效，不能作为当前 Go/Combo 的验收依据 |
| `Script/check-references.js` | 已有引用检查 | CI 未执行 |
| `.github/workflows/format_and_test.yaml` | 只运行旧测试，无 Combo 生成/引用检查；push 仅匹配 main | 默认分支与变体一致性未覆盖 |
| Vivo Native | 本地 244 条，上游 243 条 | 5 条上游条目缺失，另有 6 条本地独有条目 |
| Huawei Native | 本地 135 条，上游 135 条 | 与上游完全一致 |
| Native 更新 | 未发现实际同步 workflow | 旧注释所称每日同步未落地 |

### 已确认的问题

**P0 — SystemHelper 被 private 规则抢先。** 原 Go 顺序为 private 直连在前、SystemHelper 进程/域名规则在后。先命中 private 的连接不会继续匹配后面的进程规则。

**P0 — Combo 生成产物脱节。** 上一轮 SystemHelper 规则已进入 Go 主脚本，但 Combo 生成文件没有继承；差异层锚点仍依赖旧开关结尾结构。此前 PR 自动审查也报告了生成器锚点失效。

**P1 — Go 主脚本广告防线太靠后。** 国内直连规则先于 AWAvenue，可能抢先认领广告/统计域名。Combo 有防线前移设计，但没有回迁主脚本。

**P1 — CI 未覆盖关键防护。** 原 CI 只运行旧测试；旧测试清单指向当前仓库不存在的 `Script/Script.js`，因此在读取测试对象时就失败。即使临时改指向 Go/Combo，旧通用测试也有一批针对旧版脚本行为的断言不适用。需要独立的 Go/Combo 防护专项测试，而不是把旧测试硬套到新脚本。

**P1 — 名单缺少来源与风险治理。** Native 名单有版本差异；设备厂商名单不适合无条件对所有设备启用；本地独有条目应单独保留、待验证。

### 外部项目实践

- HaGeZi Native Tracker：按设备厂商拆分名单，并区分不同强度；更激进名单可能影响设备功能。<https://github.com/hagezi/dns-blocklists>
- TrackerControl：结合 Disconnect、DuckDuckGo Tracker Radar、SDK 签名与运行时连接数据；不依赖 HTTPS MITM。<https://github.com/TrackerControl/tracker-control-android>
- RethinkDNS：以应用身份记录连接、目标 IP、时间和阻断状态。<https://docs.rethinkdns.com/firewall/>
- NextDNS CNAME Cloaking：要求匹配 CNAME 目标及多级子域，普通静态域名规则不能自动实现。<https://github.com/nextdns/cname-cloaking-blocklist>
- ACL4SSR：BanProgramAD 独立维护应用广告规则，并提示可能有轻微副作用。<https://github.com/ACL4SSR/ACL4SSR>
- Android VPN Lockdown：Always-on VPN 与 Block connections without VPN 可在系统层阻止 VPN 外流量。<https://developer.android.com/develop/connectivity/vpn>

## 二、实施改进

1. **统一防线：** 将 AWAvenue、AdRules、Native Vivo/Huawei、BanProgramAD、例外名单和定点规则整合进 Go 主脚本；Combo 差异层只保留 Spark 等个人定制。
2. **重排优先级：** SystemHelper 包名和域名封锁置于 private 之前；private 先于全局端口规则；端口规则后才执行通用例外；所有通用防线位于国内直连之前。
3. **分离风险开关：** Go 主脚本的 Vivo/Huawei Native 默认关闭；Combo 依个人设备配置启用；Vivo 历史 6 条本地独有域名独立开关、默认关闭。
4. **修复名单：** Vivo 官方名单更新为 HaGeZi 当前 243 条，6 条历史本地条目单独保留；Huawei 按上游 135 条规范化。
5. **增加安全同步：** 每日同步 workflow；只接受严格 `||domain^` 语法，核对条目数、重复项和域名格式；异常时停止更新。
6. **加强 CI：** 修复 Combo 锚点，重新生成 Combo；增加防护专项测试、引用完整性检查和生成物一致性门禁；push 触发增加默认分支 `myclash-rules`。

## 三、验证状态与边界

本次已完成仓库文件审计、HaGeZi 上游名单条目比对、变体生成算法重放和静态核对。PR CI 已执行变体生成、生成物一致性、配置引用检查和防护专项测试。旧通用测试入口已确认失效，本 PR 不把它列为通过项。

以下尚未完成，不能声称已验证：
- 当前 Bettbox/Mihomo 二进制的 `mihomo -t`。
- Android 真机对 SystemHelper 包名的进程归属识别。
- Wi-Fi / 移动网络、IPv4 / IPv6、Private DNS 不同组合下的流量逃逸测试。
- Vivo 历史 6 条补充域名的实际用途。
- OPPO/Realme、Xiaomi、Samsung、Apple Native 名单接入。
- CNAME Cloaking 解析链识别；Mihomo 静态规则无法检查 HTTPS 加密请求体，也不能阻止离线本地采集或绕过 TUN 的流量。

## 四、验收条件

1. `node Script/build-variants.js` 成功，且生成产物无未提交差异。
2. `node Script/check-references.js` 的 Go/Combo rich/minimal 夹具通过。
3. `node Test/defense.test.js` 的顺序、开关和 provider 测试通过。
4. `node Test/run-tests.js` 既有测试通过。
5. 使用真实 Mihomo 二进制和 Android 真机验证后，才可宣布运行时防护测试完成。

**结论：** 本次重点是统一防护源、修复规则优先级、避免变体失步、限制例外放行范围，并建立规则更新与回归门禁，而不是无差别堆叠名单。
