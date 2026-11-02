# 四件套差异层（生成制）

`mihomoScriptGo.js` 是唯一源文件。其余三件套由 `Script/build-variants.js`
套用本目录下的差异层生成，**不要直接编辑生成物**：

| 生成物 | 差异层 | 内容 |
| --- | --- | --- |
| mihomoScriptGo-smart.js | smart.json（7 个操作） | Smart 内核改造：Auto/Eco-Auto 组改 type:smart、buildSmartBaseOption、5 个 Smart 开关 |
| mihomoScriptGo-combo.js | combo.json（21 个操作） | Spark 专属分组与隔离、完整防线（例外名单/AWAvenue/AdRules/厂商遥测/BanProgramAD/主防线段）、GLOBAL 精简 |
| mihomoScriptGo-smart-combo.js | smart-combo.json（26 个操作） | 上两者的叠加（独立抽取，非手工拼接） |

## 维护约定

- 共享改动只改 `mihomoScriptGo.js`，然后运行 `node Script/build-variants.js` 重新生成。
- 变体专属改动改对应差异层里的 find/replace，再重新生成。
- 每层是一组带上下文锚点的替换操作，自底向上应用；锚点在源文件中
  找不到或不唯一时生成器会报错停机，不会静默产出错误文件。报错时
  按提示更新对应操作的锚点即可。
- 生成器只保证操作可应用；生成物仍需过一遍冒烟（生成配置、规则集
  清单）再推送。

差异层于 2026-11-02 由四件套现行文件逐行 diff 机械抽取，生成器
回代验证与现行文件逐字节一致。
