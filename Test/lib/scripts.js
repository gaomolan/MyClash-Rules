'use strict';

/**
 * 当前仓库的维护脚本清单。
 * 旧通用 unit/integration 套件针对已删除的 Script.js / mihomoScript.js，
 * 且部分断言与 Go/Combo 的策略设计不同，不应错误套用到新脚本。
 * Go 与 Combo 由专门的隐私防护回归测试覆盖；两者均进入 ES2020 / QuickJS 检查。
 */
const SCRIPTS = [];

const SCRIPT_FILES = [
  'Script/mihomoScriptGo.js',
  'Script/mihomoScriptGo-combo.js',
];

module.exports = { SCRIPTS, SCRIPT_FILES };
