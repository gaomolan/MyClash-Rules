# DNS 与解析链路专题（WP-6 定稿）

> 状态：**定稿（final）**，2026-10-28。取代同名 WP-2 底稿：底稿的模型部分（§1/§3/§5 原稿）经源码复核与配置生成级实测后保留并标注，新增我方脚本逐字段对照（§2）、路由决策表（§4）、字段优先级矩阵（§6）与实验执行记录（§8）。
> 被测基线：`gaomolan/MyClash-Rules` @ `cc46de0`，Go 主版 `Script/mihomoScriptGo.js`（1988 行，sha256 `8a2cef4a…f301f71b3b8`，WP-1 基线克隆本地副本，SRC-901）。
> 证据分工：字段官方语义引 WP-2 语义卡（`mihomo_config_semantics.md`，SRC-902 转引 SRC-201~216）；脚本行为以源码直读（E2）与 Node 运行 `main()` 的配置生成级实测（E4）为准。**配置生成级证据只证明「脚本生成什么」，不证明内核运行时如何执行**；运行时条目一律标待实测并给出所需环境。

---

## 1. 两种 DNS 处理模式（enhanced-mode，内核内建默认 redir-host，E3）

| 维度 | fake-ip | redir-host |
|---|---|---|
| DNS 应答 | 对未被 fake-ip-filter 排除的域名返回 fake-ip-range 内的虚拟 IP，并维护「域名 ↔ 虚拟 IP」映射 | 返回真实解析得到的 IP |
| 连接建立时 | 内核凭虚拟 IP 反查域名，用域名做规则匹配与出站（代理节点收到的是域名） | 连接直接携带 IP；域名规则要靠连接元数据/嗅探补回（sniffer 的 force-dns-mapping 即为此设，默认 true） |
| 优点（机制层面） | 规则匹配不依赖真实解析结果，天然免疫「解析被污染即误路由」；IP 类规则在连接时按域名再解析裁决 | 应答即真实 IP，与不感知 fake-ip 的应用/系统行为更接近；无映射表状态 |
| 代价（机制层面） | 依赖映射表状态（profile.store-fake-ip 可持久化映射）；某些按 IP 直连逻辑工作的应用可能不兼容；被 filter 排除的域名退回真实解析路径 | 先解析后匹配，解析结果直接影响 IP 规则走向；DNS 污染会传导为路由错误 |

我方脚本的选择：**全线强制 fake-ip**（§2），不提供 redir-host 选项。即上表左列的优点与代价被整体接受，其中「按 IP 直连逻辑工作的应用」一类由 fake-ip-filter 的规则集（private / fakeip_filter / geolocation-cn，见 §2.1）承担豁免。

## 2. 我方 Go 主版实际 DNS 配置逐字段对照

来源：`buildDnsAndHostsConfig`（L1686–1815）与常量定义（L1503–1505），运行实测见 EXP-DNS-09（§8）。

### 2.1 脚本写入的字段（共 16 键，E4 实测确认键清单）

| 字段 | 脚本写入值 | 官方默认/语义（WP-2 语义卡） | 偏差与判定 |
|---|---|---|---|
| `enable` | `true`（恒写） | 默认 false；不写则整段不生效（A1） | 符合语义卡的风险要求，正确 |
| `ipv6` | `IPv6总开关===true && WebRTC走代理!==true`（L1765） | 默认 false；仅管 AAAA 应答（A6） | 两开关与逻辑耦合，非官方字段组合；专项分析在 WP-7 定稿 §1 |
| `use-hosts` / `use-system-hosts` | 均 `true` | 均默认 true（A5） | 与默认一致，显式写明 |
| `cache-algorithm` | `'arc'` | 默认 `lru`（A3） | **显式偏离默认**。语义卡禁止无数据声称 arc 更快；脚本未附选择依据，记为待说明项（WP-15 输入） |
| `prefer-h3` | `false`（恒写） | 默认 false（A4） | 与默认一致；注释理由为冷启动避免 H3 探测卡顿。附带效果：脚本自身 DoH 永不走 H3，WP-7 §6 的「QUIC 拦截自伤 DNS」风险面对自身 DNS 不成立 |
| `enhanced-mode` | `'fake-ip'`（恒写） | 默认 `redir-host`（A16） | **核心偏离**，见 §1 |
| `fake-ip-range` | `'198.18.0.1/15'` | 内建默认 `198.18.0.1/16`（A17） | 地址池为内建默认的 2 倍（/15 覆盖 198.18.0.0–198.19.255.255，纯 CIDR 算术）。TUN 默认 IPv4 地址亦参考此值（A17），影响面待运行时确认 |
| `fake-ip-range6` | `'2001:2::1/48'`（恒写） | 内建无默认（A17） | 显式补齐 v6 虚拟段；与 dns.ipv6=false 并存时该段实际是否被使用，待实测 |
| `fake-ip-filter` | `['rule-set:private', 'rule-set:fakeip_filter', 'rule-set:geolocation-cn']` + FCM 开时 `'rule-set:googlefcm'` + 输入 filter 与节点域名的交集（EXP-DNS-10 实测） | 内建默认仅微软连通性检测三域名（A0）；mode 默认 blacklist（A18） | **整体替换**：内建默认三域名不再由内核自动包含，改由 bett-rules 的 `fakeip_filter` 规则集是否覆盖决定——**未逐条核对，列未验证项 U-DNS-1**。filter-mode 未写，沿默认 blacklist |
| `default-nameserver` | `['114.114.114.114#DIRECT', 'https://1.12.12.12/dns-query#DIRECT']`（`defaultDNS`，L1505） | 必须为 IP，可为加密 DNS（A8） | 两条均为 IP 形式（一明文 UDP、一 IP 字面 DoH），满足硬约束；引导链不依赖任何域名解析 |
| `proxy-server-nameserver` | `['114.114.114.114#DIRECT', 'https://doh.pub/dns-query#DIRECT']`（`proxyServerDNS`） | 仅解析节点 server 域名（A13） | 第二条含域名 `doh.pub`：其解析由 default-nameserver（IP 链）完成，且 hosts 另行钉死 `doh.pub → 1.12.12.12 / 120.53.53.53`（use-hosts=true）形成双保险；内核引导解析实际走哪条路径**未实测（U-DNS-2）**。恒写本字段的另一收益：即使外部开启 respect-rules，也不触发 A13 的「为空即报错」 |
| `proxy-server-nameserver-policy` | 条件生成（§2.3） | 仅 psn 非空时生效（A13） | 实测行为见 EXP-DNS-10/10B/11 |
| `nameserver` | `foreignDNS` = `['https://cloudflare-dns.com/dns-query#默认代理', 'https://dns.google/dns-query#默认代理']`（L1504） | 主解析链（A9） | 国外解析**只有这一链**：两条加密 DoH 均以 `#默认代理` 后缀指定经同名策略组出站。该组由脚本恒生成（select 型，成员为地区组/基础组/自定义组），EXP-INT-01 实测引用完整 |
| `nameserver-policy` | 固定三条：`rule-set:private → 'system'`；`rule-set:douyin → ['system', '180.184.1.1', '180.184.2.2']`；`rule-set:cn → chinaDNS` | policy 优先于 nameserver/fallback（A12） | 输入配置自带的 nameserver-policy **不保留**（仅其与节点域名相交的部分被转入 psn-policy，见 §2.3）——用户若在订阅里配了自定义 policy，覆写后丢失，属全权替换的已知代价 |
| `direct-nameserver` | `chinaDNS` = `['119.29.29.29#DIRECT', '114.114.114.114#DIRECT']`（L1503） | DIRECT 出口重解析（A14） | 两条明文 UDP、直连出站。与 policy 中 cn 条目同源同值 |
| `direct-nameserver-follow-policy` | `true`（恒写） | 默认 `false`（A14） | **显式偏离默认**：直连重解析遵循 nameserver-policy，使节点域名 policy 等条目在直连路径同样生效，与 psn-policy 派生逻辑配套 |

### 2.2 脚本未写入的字段（缺失即沿内核内建默认）

| 字段 | 内建默认（语义卡） | 未写的后果与判定 |
|---|---|---|
| `fallback` / `fallback-filter` | 无默认（不配不启用，A10/A11） | 国外链无并发备份与污染裁决。设计上由「只经代理的加密 DoH」替代污染模型，逻辑自洽；但**可用性单点**：默认代理组无可用节点时国外解析整体中断（失败表 F11）。fallback-filter.geosite 已被官方废弃（A11），脚本未用，无迁移债 |
| `respect-rules` | false（A15） | 未启用。脚本以逐服务器 `#组名`/`#DIRECT` 后缀实现等价的出站指定，粒度更细且不触发 A13 硬约束联动。此为实现路线选择，列 WP-15 决策输入 |
| `listen` | 空（A2，空时行为待实测） | 脚本从不写 dns.listen（源码仅 L1690 读取输入值用于 hosts 改写判定）。裸 mihomo 场景下监听行为未决（EXP-DNS-08）；Bettbox 场景由 App 侧处理（§2.4） |
| `fake-ip-ttl` | 1（A19，单位未注明） | 沿默认 |
| `ipv6-timeout` | 100ms（A7） | 沿默认；AAAA 竞速行为细节官方未述 |
| `fake-ip-filter-mode` | blacklist（A18） | 沿默认 |

### 2.3 输入配置的合并语义（配置生成级实测，E4；细节见 EXP-DNS-10/10B/11）

dns 段整体被脚本**全权替换**，但输入中的三类信息被定向打捞并转义进新段：

1. **节点域名 policy 打捞**：输入 `nameserver-policy` 与 `proxy-server-nameserver-policy` 中，键能匹配任一节点 server 域名的条目被收入 `proxy-server-nameserver-policy`；值经 `stripDnsSuffix` 处理——后缀含 `direct`/`直连` 时规范化为 `#DIRECT`，**其余后缀（如 `#默认代理`、组名）被整体剥离**，即私有节点 DNS 一律改为直连解析（与「节点解析不得依赖代理」的引导原则一致，但属静默改写，用户不可见）。
2. **私有 nameserver 兜底指派**：当上一步无任何匹配时，从输入 `nameserver` + `proxy-server-nameserver` 中剔除公共 DNS（`commonDnsList` 子串正则过滤，含国内外主流公共解析）后的剩余条目被视为私有 DNS，逐个指派给全部节点域名；覆盖全部节点域名且同 DNS 时，`simplifyDomainPolicy` 会把三段及以上同后缀域名合并为 `+.` 后缀形式（EXP-DNS-10B 实测：三个 `*.example.test` 节点合并为单条 `+.example.test`）。
3. **fake-ip-filter 交集**：输入 filter 仅保留能匹配节点域名的条目，其余（包括用户为应用域名写的豁免）一律丢弃。
4. **hosts 的特殊路径**：仅当输入恰有单个 proxy-server-nameserver 且其与 dns.listen 满足脚本注释中的两条件之一时，输入 hosts 被用于**改写节点 server**（支持链式映射，EXP-DNS-11 实测 hk01 域名被改写为指定 IP），且该路径下输入 psn 不再参与私有派生。无论哪条路径，**输入 hosts 本身不进入输出**——输出 hosts 恒为脚本固定表（DoH 域名钉死、谷歌商店别名、哔哩哔哩 PCDN 屏蔽四条）。

健壮性注记（E2 代码直读）：`commonDnsRegex` 由公共 DNS 清单转义后以 `|` 拼接、**无锚点子串匹配**——形如 `https://doh.pub.example.test/…` 的私有 DNS 会因含子串 `doh.pub` 被误判为公共 DNS 而剔除。影响面限于「自建私有 DNS 域名恰含公共 DNS 子串」的订阅，等级低，列 WP-14 用例输入。

重复键附带发现（E2，跨 WP-8）：`baseRuleProviders` 中 `cn` 规则集被定義两次（L366 带引号 `'cn'` 与 L387 不带引号 `cn`，JS 中为同一键），内容逐字相同，后者静默覆盖前者——当前无行为差异，但属编辑陷阱（改第一处不生效）。`cn` 同时被本文 §2.1 的 nameserver-policy（`rule-set:cn`）与兜底规则引用，归 WP-8/WP-14 处理。

### 2.4 与客户端的交互（引 WP-10 结论，SRC-903）

- **Bettbox**：执行序为脚本先行、App patch 在后。DNS 段仅当 App 的 override-dns=true 或脚本 DNS 未启用时才被 App 参数替换；overrideDns 默认 false 且脚本恒写 `enable:true` → **默认路径下脚本 DNS 全量生效**。App 强制项中与 DNS 相关者：Android 下 DNS 监听 :53 改 :10053（App 侧处理 listen，与 §2.2 的 listen 缺失互补）、FallbackFilter.GeoSite 清空（脚本无 fallback，不受影响）。顶层 `ipv6` 属 general 段、App 已设值时 App 赢——那是流量面，与本段解析面分属两层（WP-7 §1.2）。
- **Clash Verge Rev**：脚本在覆写链内执行、无事后 patch 层；其设置层与脚本输出的最终优先级细节 WP-10 未逐项核对（未验证项 U-DNS-3）。
- **裸 mihomo**：无任何接管层，脚本输出即最终配置；listen 缺失的行为（EXP-DNS-08）只在此场景成为问题。

## 3. 解析链路流程（据官方流程图 SRC-202，E2；方括号内为我方实际取值）

```
连接进入（携带域名）
│
├─ 规则匹配
│   ├─ 命中域名类规则
│   │   ├─ 动作=代理 → 域名直接交给代理节点（本地不解析）
│   │   └─ 动作=直连 → 进入解析；[direct-nameserver=chinaDNS + follow-policy=true] 重新解析 → 按 IP 直连
│   └─ 命中 IP 类规则 / 需要 IP 才能裁决
│       └─ 进入解析：
│           ├─ nameserver-policy 命中 [private→system / douyin→system+火山 / cn→chinaDNS] → 用 policy 服务器
│           └─ 未命中 → nameserver [两条经代理 DoH]（[无 fallback：]结果即终局，无污染裁决环节）
│           得 IP 后：
│               ├─ IP 裁决=代理 → 把域名发送给代理节点
│               ├─ IP 裁决=直连 → 用 direct-nameserver 重新解析 → 直连
│               └─ [fake-ip 模式下应用侧拿到的是虚拟 IP，内核凭映射还原域名后走同一流程]
```

与底稿流程图的实质差异只有一处：**fallback 并发+裁决环节在我方配置中不存在**，未命中 policy 的解析是单链终局。底稿 §3 的其余要点（policy 优先级、direct 重解析的版本注记、fake-ip 双轨）经复核仍成立。

## 4. DNS 请求路由决策表（我方配置实例化）

| # | 查询类别 | 决策路径 | 实际服务器 | 出站方式 | 证据 |
|---|---|---|---|---|---|
| D1 | 应用域名（国外，未命中 policy） | nameserver | Cloudflare / Google DoH | 经「默认代理」组（`#默认代理` 后缀） | E4（EXP-DNS-09 输出） |
| D2 | 应用域名（命中 `rule-set:cn`） | nameserver-policy | 119.29.29.29 / 114.114.114.114（明文 UDP） | 直连（`#DIRECT`） | E4 |
| D3 | 应用域名（命中 `rule-set:private`） | nameserver-policy | `system`（系统 DNS） | 随系统 | E4 |
| D4 | 抖音域名 | nameserver-policy | system + 180.184.1.1 / 180.184.2.2 | 直连 | E4 |
| D5 | IP 类规则裁决所需的解析 | 同 D1/D2（按域名是否命中 policy） | 同上 | 同上 | E2（官方流程） |
| D6 | 已判直连后的重解析 | direct-nameserver（follow-policy=true，先过 policy） | chinaDNS（或 policy 命中者） | 直连 | E4（字段值）+ E2（流程） |
| D7 | 代理节点 server 域名 | proxy-server-nameserver（+ 条件生成的 psn-policy） | 114.114.114.114 / doh.pub DoH（或用户私有 DNS 派生条目） | 直连（`#DIRECT`） | E4 |
| D8 | DNS 服务器自身域名（cloudflare-dns.com / dns.google / doh.pub） | default-nameserver（引导）+ hosts 钉死 | 114.114.114.114 / 1.12.12.12 DoH；hosts 另钉 IP | 直连 | E4（字段与 hosts 输出）；实际命中路径 U-DNS-2 |
| D9 | 规则集 / Geo 数据下载域名 | 非 DNS 字段问题：下载连接按普通规则匹配；`raw.githubusercontent.com`、`cdn.jsdmirror.com` 有 prefixRules 前两条恒直连规则 | 业务解析链（D1/D2） | 直连（上述两域名）/ 其余按规则 | E2（prefixRules L124 段）+ E4（规则序） |
| D10 | fake-ip-filter 命中的域名 | 绕过虚拟 IP，走真实解析后按规则连接 | 视域名走 D1/D2 | 视规则 | E2 |

注记：`cn_additional` 规则集的下载域名 `static-file-global.353355.xyz` 无专门前置直连规则，走 D9 的「其余按规则」路径；provider 下载发生在核心启动后、业务解析链已可用，不构成引导阻塞（E2 推导）。

## 5. 引导依赖图（我方配置实例化）

```
[default-nameserver：纯 IP 链] ──解析──▶ cloudflare-dns.com / dns.google / doh.pub
        │                                    ▲（hosts 钉死同三域名，use-hosts=true，双保险）
        ▼                                    │
[nameserver：两条 DoH #默认代理] ──出站需要──▶ [默认代理 组] ──成员──▶ 代理节点
        │                                                              │ 节点 server 若为域名
        │                                                              ▼
        │                                          [proxy-server-nameserver：#DIRECT 直连链]
        │                                                              │（不经代理 → 循环在此打破）
        ▼                                                              │
[应用解析与规则裁决] ◀──────────────────────────────────────────────────┘

[rule-providers / geox 下载] ──域名解析借业务链；raw.githubusercontent.com 与
 cdn.jsdmirror.com 由 prefixRules 恒直连，避免「规则未加载→下载域名被误路由」
```

循环依赖的打破方式（与官方 respect-rules 路线对比）：官方用「respect-rules + 强制 psn 非空」防循环；我方不启用 respect-rules，DNS 服务器的出站由每条服务器自带的 `#` 后缀逐个指定（国外链→默认代理组、其余→DIRECT），节点域名解析恒走直连链。两条路线都不成环，但我方的正确性依赖一个隐含前提：**默认代理组的成员节点域名必须能被 psn 链解析**——psn 链为纯直连且服务器均为国内可直达者，前提成立（E2）。

## 6. 配置字段优先级与覆盖矩阵

| 对象 | 输入订阅 | 脚本 | Bettbox App | 内核内建默认 | 最终胜者（默认路径） |
|---|---|---|---|---|---|
| dns 段整体 | 被打捞三类信息后整体丢弃（§2.3） | 全权生成 16 键 | override-dns=true 时整体替换 | 仅回填脚本未写字段 | **脚本**（App 开 override-dns 时 App） |
| dns.ipv6 | 不保留 | 与逻辑生成 | 不在 App DNS 覆盖的常规路径内（WP-10） | false | **脚本** |
| 顶层 ipv6 | `=== undefined` 才被脚本动 | 条件写 false（WP-7） | general 段已设值时覆盖脚本 | true | **App（已设时）> 输入 > 脚本条件写 > 默认** |
| hosts | 仅作节点改写数据源，不进输出 | 固定表全权写 | hosts 在 App patch 覆盖清单内（WP-10） | — | **App（启用其 hosts 参数时）> 脚本** |
| dns.listen | 读取后丢弃 | 不写 | App 强制项处理（Android :53→:10053） | 空（行为待实测） | **App / 内核**（脚本弃权） |
| 节点 server 域名解析策略 | policy/psn 被打捞 | 派生生成 psn-policy | — | 沿主链 | **脚本派生结果** |

## 7. 失败场景与恢复路径表

底稿 F1–F10 经复核保留（机制推导者已标注），按我方配置修正三处并新增 F11：

- F1（default-nameserver 填域名）：我方两条均为 IP 形式，**该风险已由构造消除**。
- F4（respect-rules=true 且 psn 为空 → 启动报错）：脚本恒写 psn，即使外部另行开启 respect-rules 也**不触发**；构造免疫。
- F9（TUN dns-hijack 与系统私人 DNS 并存）：仍成立且脚本不可控，须在用户文档明示（WP-10 协同）。
- **F11（新增）默认代理组无可用节点**：国外解析链（D1）整体中断，且无 fallback 兜底；国内链（D2/D6/D7）独立存活，表现为「国内站正常、国外站全灭」。恢复路径：切换默认代理组成员/等待健康检查恢复。脚本内无自动缓解——这是单链设计的明确取舍，列 WP-15 决策输入（是否引入 fallback 或第二出站组）。

## 8. 实验清单：步骤、判据与执行状态

配置生成级实验已于 2026-10-28 在隔离目录执行（Node v24.22.1，vm 加载被测脚本，输入为 `*.example.test` 虚构域名与 TEST-NET 地址；脚本与日志见 `07-validation/_work_wp67/`，登记于 `07-validation/experiment_log.csv`）。

| ID | 场景与步骤 | 预期判据 | 状态与结果 |
|---|---|---|---|
| EXP-DNS-09 | 最小合成输入运行 main()，全量导出 dns/hosts | 16 键与 §2.1 表逐项一致；无 fallback/respect-rules/listen 键 | ✅ 已执行（E4）：全部符合；dns 键清单与字段值见日志 |
| EXP-DNS-10 | 输入带私有 nameserver/psn/policy/fake-ip-filter（其中 policy 一条匹配节点域名、一条不匹配）运行 | 匹配条目入 psn-policy 且后缀被剥离/规范化；不匹配条目与 filter 非交集条目被丢弃 | ✅ 已执行（E4）：`hk01.example.test → https://private-a.example.test/dns-query`（`#默认代理` 被剥离）；filter 仅保留 `hk01.example.test` |
| EXP-DNS-10B | 输入仅私有 nameserver、无任何 policy 运行 | 私有 DNS 被指派给全部节点域名，同后缀同 DNS 时合并为 `+.` 形式 | ✅ 已执行（E4）：生成单条 `+.example.test → [私有 DoH]` |
| EXP-DNS-11 | 输入单 psn+listen 满足 hosts 改写条件、hosts 含节点域名映射运行 | 节点 server 被改写为映射 IP；输入 hosts 不出现在输出 hosts；该路径不生成 psn-policy | ✅ 已执行（E4）：三项全部符合（server 改写为 203.0.113.7） |
| EXP-DNS-07C | IPv6 组合的配置生成级部分：输入顶层 ipv6（未设/true/false）× 总开关 × 开关1 共 12 组合运行 | 顶层输出与 dns.ipv6 与 §6/WP-7 §1.2 矩阵逐格一致 | ✅ 已执行（E4）：12 格全符合（详表在 WP-7 定稿） |
| EXP-INT-01 | 对默认输出做引用完整性静态校验：全部规则目标、RULE-SET 引用、dns 中 rule-set 引用与 `#` 后缀组名 | 全部可解析到生成的组/provider，问题数 0 | ✅ 已执行（E4）：96 规则 / 26 组 / 38 providers，问题 0（校验器对 `,no-resolve` 后缀的解析修正过程记于日志） |
| EXP-DNS-01 | 国内/国外域名解析路径分离（运行时） | 上游计数与 D1/D2 表一致 | ⏳ 待实测：需裸 mihomo v1.19.33 + 可控上游（本地 CoreDNS/dnsmasq 替身）+ `.test` 权威区 |
| EXP-DNS-02 / 05 | 规则集 URL 不可达 / 预置过期缓存启动 | 启动成败、规则空缺形态、缓存回退行为 | ⏳ 待实测：同上环境 + provider 指向 `https://rules.invalid.test/` |
| EXP-DNS-03 | 上游黑洞（nameserver 链断、psn 链正常及反之） | 失败时延与 F11 的表现形态 | ⏳ 待实测：同上 + 黑洞 IP（TEST-NET）注入 |
| EXP-DNS-04 | 节点域名 + psn 指向黑洞冷启动 | 报错路径与恢复操作 | ⏳ 待实测：同上 |
| EXP-DNS-06 | Bettbox override-dns 开/关 × 同一脚本输出 | 哪段 dns 最终生效，与 §2.4 对照 | ⏳ 待实测：需 Bettbox 实机（用户主力机），属 E5 路径，本阶段不执行 |
| EXP-DNS-07（运行时部分） | §WP-7 真值表的 AAAA 应答与字面地址连接 | 与生成级矩阵的运行时对应关系 | ⏳ 待实测：同 EXP-DNS-01 环境 + v6only 替身记录 |
| EXP-DNS-08 | dns.enable=true 且 listen 缺失（脚本默认输出）裸跑 | 是否监听、地址与协议 | ⏳ 待实测：裸 mihomo + 端口探测 |

## 9. 已验证 / 未验证清单

**已验证（E4 配置生成级，除注明者）**
- V-DNS-1：默认 dns 段的 16 键与全部字段值（EXP-DNS-09）；无 fallback、无 respect-rules、无 listen。
- V-DNS-2：私有 DNS 三条打捞路径（policy 交集、兜底指派+后缀合并、filter 交集）与 hosts 改写路径的行为（EXP-DNS-10/10B/11）。
- V-DNS-3：IPv6 双层输出的 12 组合矩阵（EXP-DNS-07C，细节在 WP-7）。
- V-DNS-4：默认输出的引用完整性（EXP-INT-01，问题 0）。
- V-DNS-5（E2 源码）：default-nameserver/psn 均为可直达链；`#` 后缀剥离与规范化规则；commonDns 子串过滤的实现方式；hosts 全权替换。

**未验证（不得在后续文档中以事实引用）**
- U-DNS-1：bett-rules `fakeip_filter` 规则集是否覆盖内核内建默认的微软连通性检测三域名（dns.msftnsci.com 等）。
- U-DNS-2：doh.pub 在引导期实际经 default-nameserver 解析还是经 hosts 钉死命中（内核实现路径）。
- U-DNS-3：Clash Verge Rev 设置层与脚本 dns 输出的最终优先级细节。
- U-DNS-4：全部运行时行为（EXP-DNS-01~06、07 运行时部分、08），含 F3/F6/F11 的真实表现与时延。
- U-DNS-5：fake-ip-range /15 与 fake-ip-range6 在 TUN/多设备场景的实际影响；dns.ipv6=false 而 fake-ip-range6 存在时 v6 虚拟段是否被使用。
- U-DNS-6：`rule-set:cn` 在 nameserver-policy 中的运行时匹配口径（geosite cn 与 providers 中 `cn` 规则集的数据一致性，含 §2.3 重复键注记的运行时面）。

## 10. 对 WP-14 的测试用例输入（场景清单）

- TC-DNS-01：默认输入生成 dns 段黄金快照（16 键逐值比对，EXP-DNS-09 固化为回归）。
- TC-DNS-02：私有 policy 交集/丢弃矩阵（匹配、部分匹配、零匹配 × 后缀为组名/#DIRECT/无后缀）。
- TC-DNS-03：私有 DNS 域名含公共 DNS 子串（如 `doh.pub.example.test`）时兜底指派是否被误剔（对应 §2.3 健壮性注记）。
- TC-DNS-04：hosts 改写两条件各自命中/不命中 × 链式映射 × 回环映射终止。
- TC-DNS-05：节点 server 全为 IP 时 psn-policy 不生成（空对象不写入键）。
- TC-DNS-06：FCM 开关关时 fake-ip-filter 不含 googlefcm 条目（开关联动回归）。
- TC-DNS-07：生成配置引用完整性（EXP-INT-01 校验器产品化为 CI 检查）。
- TC-DNS-08：运行时组（需内核环境）：EXP-DNS-01/02/03/04/05/08 全套，含 F11 表现形态断言。

## 11. 对 WP-15 的决策输入（选项与权衡）

| 决策点 | 选项 | 权衡 |
|---|---|---|
| 国外解析可用性 | A 维持单链（现状）／B 增配 fallback（境外明文/加密各一）／C 第二条 `#` 后缀指向备用组 | A 最简、行为最可预测，但 F11 无缓解；B 引入并发裁决与污染模型复杂度（且 fallback-filter.geosite 已废弃，需以 policy 替代设计）；C 保持单链语义、只换出站冗余，复杂度最低 |
| DNS 出站指定方式 | A 逐服务器 `#` 后缀（现状）／B respect-rules=true | A 粒度细、无启动硬约束联动；B 与官方推荐路线一致、语义集中，但改变全部 DNS 连接的路由决策路径，需重验引导链 |
| listen 显式化 | A 不写（现状，交客户端）／B 写固定值（如 127.0.0.1:1053） | A 在 Bettbox 场景无碍，裸跑场景行为未决；B 使裸跑可预测，但可能与客户端接管冲突（Bettbox Android 强制改写即为例证） |
| hosts 合并策略 | A 全权替换（现状）／B 与输入 hosts 合并（脚本条目优先） | A 保证 DoH 钉死与 PCDN 屏蔽不被订阅污染；B 保留用户自带 hosts 的可用性，但需定义冲突裁决与安全审查 |
| cache-algorithm | arc（现状）／lru（官方默认） | 无任何一手性能数据支持取舍；若无实测计划，建议回默认以减少偏离面（举证责任在偏离方） |

*来源登记：evidence/wp67-sources.csv（SRC-901 起）；实验原始日志：07-validation/_work_wp67/run_wp67.log、run_wp67b.log。*
