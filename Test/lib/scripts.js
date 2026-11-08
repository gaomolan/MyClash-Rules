'use strict';

/**
 * 实际维护的脚本测试清单。
 * run-tests.js、es2020-check.js、quickjs-check.js 共用，避免测试对象与仓库产物脱节。
 */
const SCRIPTS = [
  {
    file: 'Script/mihomoScriptGo.js',
    label: 'Go 主脚本',
    meta: {
      full: true,
      regions: ['香港', '日本', '美国', '新加坡', '台湾省'],
    },
  },
  {
    file: 'Script/mihomoScriptGo-combo.js',
    label: 'Combo 组合版',
    meta: {
      full: true,
      regions: ['香港', '日本', '美国', '新加坡', '台湾省'],
    },
  },
];

/** 脚本文件路径列表（供兼容性检查模块使用） */
const SCRIPT_FILES = SCRIPTS.map((s) => s.file);

module.exports = { SCRIPTS, SCRIPT_FILES };
