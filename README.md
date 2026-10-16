# MyClash Rules

我的自定义 MyClash 脚本订阅地址：

```text
https://raw.githubusercontent.com/ly6980/MyClash-Rules/myclash-rules/Script/mihomoScript-custom.js
```

专属脚本 mihomoScriptGo 订阅地址：

```text
https://cdn.jsdelivr.net/gh/ly6980/MyClash-Rules@myclash-rules/Script/mihomoScriptGo.js
```

---

# Clash-rules-go

Forked from [AIsouler/MyClash](https://github.com/AIsouler/MyClash)

一个Mihomo 覆写脚本，适用于 Bettbox / Clash Verge Rev / 支持 Mihomo Script 覆写的客户端。

订阅地址：https://cdn.jsdelivr.net/gh/ly6980/MyClash-Rules@myclash-rules/Script/mihomoScriptGo.js

---

## 功能特性

### 1. 新增

**策略组**

- **Financial**：金融策略组
- **AI / Claude+OpenAI**：通用 AI 组与 Claude+OpenAI 合并组。
- **Cloudflare**：官方 IP 段双规则集，手动 select.
- **地区低倍率自动选择**：每个地区组内建 `{地区}-低倍率自动选择`（url-test，隐藏）。

**能力**

- **Sniffer**：预置含金融 `skip-domain` 跳过名单的完整配置（开关控制，默认关闭）。
- **geo-auto-update**：168 小时自动更新 GEO 数据库。
- **冷启动优化**：`etag-support`（规则集 ETag 去重下载）、`prefer-h3: false`（冷启动跳过 HTTP/3 探测）。
- **地区正则扩充**：台湾增加台北/高雄/hinet 等城市关键词。
- **url-test 优化**：检测 URL 换为 `cp.cloudflare.com/generate_204`；`empty-fallback` 改为 fallback 到手动选择。

**开关**

- **WebRTC走代理**（默认开）：STUN 流量走代理。
- **屏蔽STUN端口**（默认关）：严格场景直接屏蔽 STUN 端口。
- **IPv6总开关**（默认关）：控制 `dns.ipv6`，顶层 `ipv6` 留空交客户端。
- **国内DNS走代理**（默认关）：与 `direct-nameserver-follow-policy` 联动。
- **日志级别调试**（默认关）：一键开启 debug 日志。
- **Sniffer 配置**（默认关）：预置金融跳过名单，分享场景兜底。

### 2. 精简

- 删除 7 个服务组：Steam / EHentai / Line / Netflix / Spotify / PayPal / Patreon，代码一并删除。
- 删除极简模式。
- 删除远控工具组（以后需要再加）。

### 3. 改动

**配置优先级：客户端设置优先，脚本仅补默认**

- 连接面配置（`ipv6` / `log-level` / 端口 / TUN 等 13 处）：读现有值、缺失才补默认，客户端设置优先。
- 端口判断覆盖 5 个端口；`0` 视为明确禁用，用 `=== undefined` 判断。

**其他改动**

- `nameserver-policy` 三层逻辑：订阅自带→保留；缺失→补 `cn → chinaDNS`；客户端开 DNS 覆写→客户端接管；`国内DNS走代理`开关→显式覆盖为代理 DoH。
- QUIC 独立组：国内 Direct，国外进组手动管控。
