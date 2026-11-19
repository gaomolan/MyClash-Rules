# ScriptGo-combo OpenClash 覆写订阅

订阅地址：

```text
https://raw.githubusercontent.com/gaomolan/MyClash-Rules/myclash-rules/OpenClash/ScriptGo-combo.conf
```

在 OpenClash 的「运行状态 → Overwrite Module → 添加新模块」中选择“订阅链接”，填入上述地址，下一步将匹配配置设为 `spark-cxue.yaml`，启用模块后重启 OpenClash。模块自带每日 04:00 的远程更新元信息；也可以在界面修改更新时间。

这个文件使用 OpenClash 的 `[General]` + `[YAML]` 覆写模块格式，不能当作完整 Mihomo 订阅配置直接导入。它不包含机场节点的服务器地址、密码或 UUID；节点由已导入的组合订阅提供。当前版本按照 2026-11-19 的组合订阅节点名称生成；如果订阅变更节点名称，需要重新生成并更新本文件。规则、策略组、DNS 与 GEO 设置来自用户的 ScriptGo-combo.js 和 Bettbox 自定义开关。

同一配置只启用一个 combo 覆写模块。已经在路由器上启用本地 `ScriptGo-combo` 模块时，先将它停用，再启用此远程模块并重启 OpenClash，避免重复追加直连节点。
