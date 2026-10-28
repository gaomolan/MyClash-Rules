# Mihomo 配置字段语义卡（WP-2 交付物）

> 研究基线：官方文档 MetaCubeX/Meta-Docs @ `2a6ba6b`（2026-10-22，wiki.metacubex.one 同源）；内核源码 MetaCubeX/mihomo **v1.19.33**（最新稳定版，2026-10-21 发布，SRC-216）。
> 访问日期：2026-10-28。证据等级按章程 §1.4。文档与源码一致者标 E3；仅文档有据标 E2；文档未规定者一律标「待实测」，不补全语义。
> 「代码位置」指 v1.19.33 源码中的读写/默认值位置，供后续工作包定位。Alpha 分支未做源码审计（见文末未决清单）。

---

## A. DNS 段（`dns:`）

### A0. 总览与内建默认值（源码 DefaultRawConfig，SRC-211）
当配置完全不写 `dns` 段时，内核内建默认：`enable:false`、`ipv6:false`、`ipv6-timeout:100`、`enhanced-mode: redir-host`、`fake-ip-range: 198.18.0.1/16`、`fake-ip-ttl: 1`、fallback-filter{geoip:true, geoip-code:CN}、default-nameserver=[114.114.114.114, 223.5.5.5, 8.8.8.8, 1.0.0.1]、nameserver=[https://doh.pub/dns-query, tls://223.5.5.5:853]、fake-ip-filter=[dns.msftnsci.com, www.msftnsci.com, www.msftconnecttest.com]、fake-ip-filter-mode=blacklist、use-hosts/use-system-hosts=true。注意：客户端/脚本一旦写入 `dns` 段，相应字段即以写入值为准，内建默认仅作缺省回填。

### A1. `dns.enable`
- 类型/默认：bool / `false`（E3：SRC-201 文档 + SRC-211 源码默认块）
- 语义：为 false 时使用系统 DNS 解析（文档原文）。
- 与客户端覆写：客户端（如 Bettbox）若另行接管 DNS，本字段的生效以客户端合并策略为准（WP-10 范围）。
- 风险：脚本写入完整 dns 段但 enable 缺失时默认 false，等于整段不生效——生成脚本必须显式写 enable:true。
- 验证：最小配置仅写 `dns: {enable: true, listen: 127.0.0.1:1053}`，用 dig 向该端口查询验证。

### A2. `dns.listen`
- 类型/默认：string / 空（源码默认块无此项默认；文档示例 `0.0.0.0:1053` 仅为示例，E2）
- 语义：DNS 服务监听地址，支持 udp/tcp（文档）。
- 待实测：`enable:true` 且 listen 为空时是否启动监听、监听何种地址，文档未规定 → **待实测**。
- 验证：分别在 listen 缺失/显式两种配置下探测本地 53/1053 端口与外部查询路径。

### A3. `dns.cache-algorithm`
- 类型/默认：string / `lru`（E3：SRC-201 文档明示默认 lru；SRC-214 resolver.go 仅对 `arc` 走 ARC，其余走 LRU）
- 语义：缓存算法二选一：`lru`（Least Recently Used）/`arc`（Adaptive Replacement Cache）。
- 风险：低。文档未给出两者的性能对比数据，不得声称 arc 更快。

### A4. `dns.prefer-h3`
- 类型/默认：bool / `false`（E2，文档示例与字段说明）
- 语义：DoH 优先使用 HTTP/3 建立连接。
- 风险：文档明示「强烈不建议和 respect-rules 一起使用」（SRC-201）。与单服务器 `#h3` 附加参数的区别：prefer-h3 是全局优先策略，`#h3` 是对单个服务器强制。

### A5. `dns.use-hosts` / `dns.use-system-hosts`
- 类型/默认：bool / 均 `true`（E3：文档 + 源码默认块）
- 语义：是否回应配置中的 hosts / 是否查询系统 hosts。

### A6. `dns.ipv6`（DNS 段）
- 类型/默认：bool / `false`（E3：文档 + 源码默认块）
- 语义：是否解析 IPv6；为 false 时对 AAAA 查询回应**空解析**（文档原文）。此字段只管 DNS 应答内容，**不管内核是否转发 IPv6 流量**（那是顶层 `ipv6`，见 B1）——两者混淆是本项目重点风险（R-008 关联）。
- 验证：dns.ipv6=false 时 dig AAAA 应返回空应答而 A 记录正常；顶层 ipv6 的组合行为见 WP-7 底稿真值表（待实测项）。

### A7. `dns.ipv6-timeout`
- 类型/默认：uint / `100`，单位毫秒（E3：源码默认 100；SRC-214 resolver.go 以 `time.Duration(v) * time.Millisecond` 使用）
- 语义：与 IPv6（AAAA）查询等待相关的超时参数。**具体触发条件**（何时开始计时、对 A/AAAA 竞速的影响）文档未述 → 待实测。

### A8. `dns.default-nameserver`
- 类型/默认：string 数组 / 内建默认见 A0（E2 文档语义 + E3 默认值）
- 语义：**仅用于解析 DNS 服务器自身的域名**（引导解析）。文档强制要求：必须为 IP，可为加密 DNS。
- 风险：若把 DoH 域名地址（如 doh.pub）误填且其本身需要解析，会形成引导循环；这是「鸡蛋问题」的第一环（WP-6 底稿详述）。
- 验证：nameserver 使用带域名的 DoH、default-nameserver 故意留空/填域名，观察启动日志与解析失败模式。

### A9. `dns.nameserver`
- 类型/默认：string 数组 / 内建默认见 A0
- 语义：默认域名解析服务器（主解析链）。支持的类型：udp/tcp/tls/https/quic/system/dhcp/rcode 及 ts://、et:// 等（SRC-203）。
- 硬约束（源码 parseDNS，E3）：`dns.enable=true` 且 nameserver 为空 → **配置解析直接报错**，内核无法启动。
- 附加参数：条目可用 `#` 后缀指定出站代理/接口名、`#RULES`（等同 respect-rules）、`#h3`、`#skip-cert-verify`、`#ecs=…`、`#disable-ipv4/ipv6`、`#disable-qtype-<int>` 等（SRC-201「附加参数」节）。

### A10. `dns.fallback`
- 类型/默认：string 数组 / 无内建默认（不配置即不启用）
- 语义：后备解析服务器，文档定位为「一般使用境外 DNS，保证结果可信」。配置后与 nameserver **并发查询**，结果经 fallback-filter 裁决（流程见官方解析流程图，SRC-202）。

### A11. `dns.fallback-filter`
- 子字段：`geoip`（默认 true）、`geoip-code`（默认 `CN`）、`ipcidr`、`domain`、`geosite`、`fallback-lazy-query`（默认 false）。
- 语义（E2/E3）：nameserver 的应答 IP 不属于 geoip-code 国家、或命中 ipcidr 网段 → 视为污染，改采 fallback 结果；`domain` 命中的域名只用 fallback 解析；配置 fallback 后 fallback-filter 默认启用且 geoip-code 为 CN（文档 + 源码默认块共同印证）。
- **废弃标注**：`geosite` 子字段已被官方文档标为**已废弃**，要求改用 nameserver-policy（SRC-201 warning 原文）。
- `fallback-lazy-query`：true 时先判断 nameserver 结果是否满足 filter 再发起 fallback 查询（串行换取少发请求），默认 false 为并发。

### A12. `dns.nameserver-policy`
- 类型：map（域名模式 → string 或数组）
- 语义：为指定域名指定解析服务器，**优先于 nameserver/fallback 查询**（文档原文）。键支持域名通配，也支持 `geosite:` 与 `rule-set:` 引用（文档示例含 `'rule-set:cn'` 与 `'+.arpa'`）。
- 风险：policy 命中的域名绕开 fallback-filter 的污染裁决，策略编写错误会直接放行污染结果。

### A13. `dns.proxy-server-nameserver`
- 语义：**仅用于解析代理节点的服务器域名**；不填则沿 nameserver-policy → nameserver → fallback 链（文档原文）。
- 硬约束（E3，SRC-211 parseDNS）：`respect-rules: true` 且本字段为空 → **配置解析报错**（"proxy-server-nameserver cannot be empty"）。这是防「DNS 遵守规则 → 规则需要节点 → 节点需要 DNS」循环的官方手段。
- 配套：`proxy-server-nameserver-policy` 格式同 nameserver-policy，仅当 proxy-server-nameserver 非空时生效。

### A14. `dns.direct-nameserver` / `dns.direct-nameserver-follow-policy`
- 语义：用于 DIRECT 出口的域名解析；不填则沿 policy/nameserver/fallback 链。命中 DIRECT 的连接会用它**重新解析**（官方流程图 SRC-202）。follow-policy 默认 `false`（即默认不遵循 nameserver-policy），且仅在 direct-nameserver 非空时生效。
- 版本事实（E2，SRC-202 文档注记）：重新解析原本仅限 TCP；**v1.19.10 起同样应用于 UDP 连接**（TUN 入站仅限 fake-ip 模式）。

### A15. `dns.respect-rules`
- 类型/默认：bool / `false`
- 语义：DNS 连接本身遵守路由规则（文档）。启用前置条件见 A13 的硬约束；文档同时警告不要与 prefer-h3 同用。
- 风险：开启后 DNS 服务器的连接路径依赖规则与节点可用性，冷启动顺序敏感（WP-6 失败表）。

### A16. `dns.enhanced-mode`
- 类型/默认：enum / `redir-host`（E3：文档 + 源码 `C.DNSMapping`）
- 语义：可选 `fake-ip` / `redir-host`，决定 mihomo 的 DNS 处理模式（两模式模型差异见 WP-6 底稿）。

### A17. `dns.fake-ip-range` / `dns.fake-ip-range6`
- 默认：`198.18.0.1/16`（E3）；range6 无内建默认（源码默认块未设，文档示例 `fdfe:dcba:9876::1/64` 为注释示例）。
- 语义：fake-ip 模式的虚拟 IP 段；文档注明 TUN 的默认 IPv4 地址也参考此值。

### A18. `dns.fake-ip-filter` / `dns.fake-ip-filter-mode`
- mode 可选 `blacklist`（默认）/`whitelist`/`rule`（E3）。blacklist：命中的域名不下发 fake-ip、走真实解析；whitelist：只有命中才返回 fake-ip；rule：filter 条目改写为路由式规则（如 `RULE-SET,…,fake-ip`、`DOMAIN,…,real-ip`、`MATCH,fake-ip`），自上而下匹配（文档原文）。
- filter 值支持域名通配与域名集合引用。内建默认过滤名单见 A0（微软连通性检测域名）。

### A19. `dns.fake-ip-ttl`
- 默认 `1`（E3 源码）。文档仅称「fakeip 查询返回的 TTL，非必要勿改」；**单位文档未注明 → 待实测**。

---

## B. 顶层字段（节选与本项目高相关者）

### B1. `ipv6`（顶层）
- 类型/默认：bool / `true`（E3：SRC-204 文档明示默认 true；SRC-211 源码 L489 `IPv6: true`）
- 语义：**是否允许内核接受 IPv6 流量**（文档原文）。与 A6 的 dns.ipv6 是两个独立开关：前者管流量面，后者管解析面。
- 联动：TUN 的 `inet6-address` 需要顶层 ipv6=true 才生效（SRC-209）。

### B2. 其他已核顶层默认（源码 DefaultRawConfig，E3）
`mode: rule`、`tcp-concurrent: false`、`unified-delay: false`、`find-process-mode: strict`、`profile.store-selected: true`（与组 default-selected 的持久化相关：客户端重启后恢复上次选择）、`etag-support: true`、`global-ua: clash.meta/<version>`（影响规则集/外部资源下载 UA）。

---

## C. Sniffer（`sniffer:`）

源码内建默认（SRC-211，E3）：`enable:false`、`force-dns-mapping:true`、`parse-pure-ip:true`、`override-destination:true`、sniff 端口表为空（启用时按文档示例/内置协议端口工作，具体默认端口表以文档示例为准、待实测核对）。

### C1. `sniffer.enable` — bool / false。是否启用域名嗅探。
### C2. `sniffer.force-dns-mapping` — bool / true。对 redir-host 类型识别的流量强制嗅探（文档）。
### C3. `sniffer.parse-pure-ip` — bool / true。对所有未获取到域名的流量强制嗅探（文档）。
### C4. `sniffer.override-destination` — bool / **true**（E3：文档字段说明明示默认 true + 源码默认块）。注意文档示例 YAML 中写的是 false，那是示例值不是默认值——引用示例时极易误读。
### C5. `sniffer.sniff` — 仅支持 HTTP/TLS/QUIC 三种协议，各有 `ports`（端口范围）与可覆盖全局的 `override-destination`。文档示例：HTTP [80, 8080-8880]、TLS [443, 8443]、QUIC [443, 8443]。
### C6. `sniffer.force-domain` / `sniffer.skip-domain` — 强制/跳过嗅探的域名列表，使用域名通配语法（文档）。skip-domain 是脚本侧补金融等敏感域名的官方机制；客户端 App 亦可能自带一份 skip 名单并整体替换（属客户端合并行为，WP-10 核查，不在本卡下结论）。
### C7. `sniffer.skip-src-address` / `sniffer.skip-dst-address` — 按源/目标 IP 段跳过嗅探。

---

## D. 代理组（`proxy-groups:`）

### D0. 通用字段（SRC-205 文档 + SRC-212/213 源码）
| 字段 | 类型/默认 | 语义与证据 |
|---|---|---|
| name / type | 必填 | 组名（特殊符号需引号）/ 组类型（E2） |
| proxies | 数组 | 引入出站代理或其他策略组（E2） |
| use | 数组 | 引入 proxy-providers（E2） |
| url | string | 健康检查地址。**只检查 proxies 字段的成员，不检查 use 引入的 provider 成员**（文档明示，E2）——脚本生成组时若成员全在 provider 内，组级 url 不生效 |
| interval | 秒 / 0=不定时 | 定时健康检查间隔（E2） |
| timeout | 毫秒 | 健康检查超时。文档示例 5000，**统一默认值文档未标注 → 待实测** |
| lazy | bool / `true` | E3（文档 + parser.go 默认块 `Lazy: true`）：未被选中的组不做健康检查 |
| default-selected | string | E2：为空或所填节点名不存在时，默认选组中第一个节点。源码 selector 仅保存该原始值，运行时解析（SRC-213） |
| empty-fallback | string / `COMPATIBLE` | **E3 重点**：文档明示「不支持填写代理组，只支持 proxy 名称」；v1.19.33 源码 parser.go L74–82 在为空时回填 COMPATIBLE，并在所填目标是 ProxyGroup 时**直接返回解析错误**（注释原文 "strictly forbidden to fill in a proxy group for empty-fallback"）。见文末不一致清单第 1 条 |
| max-failed-times | int / `5` | E3（文档 + groupbase.go L97–98 零值回填 5）：连接失败次数超过该值触发一次强制健康检查 |
| expected-status | string / `*` | E3（文档 + parser.go 空值回填 `*`）：健康检查期望状态码，支持 `200/302`、`400-503` 混合写法；`*` 表示不校验 |
| include-all | bool / false | E3：源码中同时置位 include-all-proxies 与 include-all-providers；引入全部出站代理与代理集合，按名称排序；**不包含策略组**（文档） |
| include-all-proxies | bool / false | 引入全部出站代理（不含组），按名称排序（E2） |
| include-all-providers | bool / false | 引入全部代理集合；**会使 use 失效**（文档明示） |
| filter | 正则 | 仅作用于 provider 引入与 include-all-proxies 的成员；多个正则用反引号分隔（文档）。注意：对 proxies 字段直列成员不生效 |
| exclude-filter | 正则 | 排除匹配成员，用法同 filter（E2） |
| exclude-type | string | **不支持正则**，以 `\|` 分隔、大小写不敏感；文档称仅排除 proxies 引入的出站代理（E2） |
| disable-udp | bool | 禁用该策略组的 UDP（E2） |
| hidden / icon | — | 仅影响 API 返回的展示状态，需前端适配（E2） |
| interface-name / routing-mark（组级） | — | 文档标「已弃用」；但 v1.19.33 源码 parser.go 实际打的是 **"was removed"** 错误日志（已移除）。按已移除对待，优先级「节点 > 组 > 全局」仅为历史语义（E3，见不一致清单第 2 条） |

### D1. `select`
手动选择组。无专属参数（通用字段中的 default-selected/disable-udp 常与之配合）。

### D2. `url-test`
专属参数 `tolerance`（毫秒，节点切换容差；**默认值文档未标注 → 待实测**）。语义：按健康检查延迟自动选最优节点，容差内不切换以防抖动（文档仅给出参数名与单位，切换细节以源码/实测为准）。

### D3. `fallback`
语义（E2）：当前节点超时时，按 proxies 顺序选第一个可用节点。

### D4. `load-balance`
专属参数：`strategy`（`round-robin` / `consistent-hashing` / `sticky-sessions`；sticky 按「来源+目标」粘滞、缓存 10 分钟过期；consistent-hashing 按目标地址，域名时用顶级域名匹配）与 `hash-key`（仅哈希类策略可用，`in-user` 表示用入站认证用户名作 key；**round-robin 配 hash-key 会直接报错**——文档 warning）。hash-key 的引入版本文档未标注 → 未决清单。

### D5. `relay`
**已弃用**（E2，文档 warning 原文）：官方要求改用节点级 `dialer-proxy`。脚本不应再生成 relay 组。

---

## E. 规则集（`rule-providers:`，SRC-207）

| 字段 | 类型/默认 | 语义与证据 |
|---|---|---|
| type | 必填：`http`/`file`/`inline` | provider 类型（E2） |
| url | http 时必填 | 下载地址 |
| path | 可选 | 本地缓存路径；不填用 url 的 MD5 作文件名。出于安全，路径被限制在 HomeDir 内，外置需 `SAFE_PATHS` 环境变量 |
| interval | 秒 | 更新间隔 |
| proxy | string | 经指定代理下载/更新该 provider（解决规则集下载的引导依赖，见 WP-6 底稿） |
| behavior | `domain`/`ipcidr`/`classical` | 必须与文件实际格式对应，填错将导致内容不可用 |
| format | `yaml`（默认）/`text`/`mrs` | mrs 仅支持 domain/ipcidr 两种 behavior；可用 `mihomo convert-ruleset` 转换 |
| size-limit | 字节 / `0`=不限制 | 下载体积上限 |
| header | map | 自定义 HTTP 请求头（如 UA、Authorization） |
| payload | 仅 inline 生效 | 内联规则内容 |
| path-in-bundle | string | 本地文件不存在时从 HomeDir 的 BundleMRS.7z 按此路径解压（meta-rules-dat 分发） |

失败行为注记：provider 下载失败时是否回退到本地缓存、缓存缺失时规则如何处理，文档本页未述 → **待实测**（WP-8/WP-14 承接）。

---

## F. TUN（`tun:`，SRC-209 文档 + SRC-211 源码默认）

| 字段 | 默认 | 语义与证据 |
|---|---|---|
| enable | false（E3） | 启用 TUN |
| stack | `mips`（E3：文档 + 源码 `C.TunMips`） | 可选 system/gvisor/mixed/mips；文档建议无问题时用 mips。注意：老资料常称默认 system，与现行文档/源码不符，引用须注明版本 |
| auto-route | true（E3 源码） | 自动设置全局路由将流量导入 TUN |
| auto-detect-interface | true（E3 源码） | 自动选择出口接口 |
| dns-hijack | 源码默认 `["0.0.0.0:53"]` | 将匹配连接导入内部 DNS 模块；不写协议默认为 udp://。文档警告：macOS/Windows 无法自动劫持发往局域网的 DNS；Android 开「私人 DNS」时无法自动劫持 |
| dns-mode | 留空=旧行为 | 取值 disabled/native/hijack。留空时：Windows/Linux 在 auto-route 开启时默认 hijack、否则 disabled；macOS 默认 disabled（文档原文）。引入版本未标注 |
| strict-route | — | Linux：使不支持的网络不可达、防地址泄漏并使 Android DNS 劫持工作；Windows：加防火墙规则阻止多宿主 DNS 泄漏；文档提示可能影响 VirtualBox 等应用 |
| device / mtu / gso / gso-max-size | — | 网卡名（macOS 必须 utun 开头）/ MTU / 仅 Linux 的 GSO |
| inet6-address | `fdfe:dcba:9876::1/126`（E3 源码） | TUN 的 IPv6 地址；需顶层 ipv6=true；启动时检查系统网卡 IPv6，不存在则禁用，可用环境变量 `SKIP_SYSTEM_IPV6_CHECK=1` 强制 |
| udp-timeout | `300` 秒（E2 文档） | UDP NAT 过期时间 |
| endpoint-independent-nat | 文档示例 false | 启用端点独立 NAT，文档称性能可能略降；默认值文档未明示 → 待实测 |
| route-address / route-exclude-address | — | auto-route 时的自定义路由网段/排除网段。旧写法 inet4-/inet6-route-* 文档标「即将废弃」 |
| include/exclude-interface、include/exclude-uid(-range)、include/exclude-package、include/exclude-mac-address、include-android-user | — | 平台限制明确：UID 仅 Linux 且需 auto-route；包名/Android 用户仅 Android；MAC 仅 Linux 且需 auto-route + auto-redirect |
| route-address-set / route-exclude-address-set | — | 仅 Linux + nftables + auto-route + auto-redirect；与任意 routing-mark 冲突（文档 warning） |

---

## G. 版本差异表（仅收录有据条目）

| 版本 | 变化 | 证据 |
|---|---|---|
| v1.19.10 起 | direct-nameserver 重新解析由仅 TCP 扩展到 UDP（TUN 入站仅限 fake-ip 模式） | E2（SRC-202） |
| v1.19.18 起 | 全局 tls 的 certificate/private-key/ech-key 为本地文件时支持自动重载 | E2（SRC-204 文档注记） |
| v1.19.33（当前最新稳定） | 组级 routing-mark/interface-name 在解析器中按「已移除」处理（错误日志）；empty-fallback 明确拒绝策略组 | E3（SRC-212） |
| 未标注版本 | fallback-filter.geosite 已废弃（改用 nameserver-policy）；relay 组已弃用（改用 dialer-proxy）；TUN 旧 inet4/inet6 路由写法即将废弃 | E2（各文档页 warning） |

## H. 文档与实现不一致 / 查无依据清单

1. **empty-fallback 填策略组**：官方文档与 v1.19.33 上游源码一致地**禁止**（解析报错）。但本项目此前在 Bettbox（smart 内核分支）实机上观察到填组名可运行——该观察与上游稳定版源码冲突，可能源于分支差异（KevinChen222 的 feat/smart-core 分叉或不同版本）。WP-2 范围内无法判定，**移交 WP-10 在目标分支源码上核对**；在此之前，面向官方内核的脚本不得依赖「empty-fallback 填组名」。
2. **组级 interface-name/routing-mark**：文档措辞为「已弃用」，源码实际为「已移除」（写了只会得到错误日志、不生效）。按已移除处理。
3. **sniffer override-destination**：文档示例 YAML 写 false，但字段说明与源码默认均为 true。示例 ≠ 默认，引用文档者易误判。
4. **TUN stack 默认值**：现行文档与源码均为 mips；大量二手资料仍写 system（旧版本）。属版本演进型不一致，引用必须带版本。
5. 查无依据/待实测字段：dns.listen 为空时的行为、fake-ip-ttl 的单位、ipv6-timeout 的精确触发条件、组健康检查 timeout 默认值、url-test tolerance 默认值、fake-ip-filter-mode=rule 与 load-balance hash-key 与 TUN dns-mode 的引入版本、endpoint-independent-nat 默认值、rule-provider 下载失败回退行为、Alpha 分支解析器差异。

*本文件为 WP-2 主交付物；WP-6/WP-7 底稿见同目录 dns_fakeip.md 与 ipv6_udp_webrtc_quic.md；来源登记见 evidence/wp2-sources.csv。*
