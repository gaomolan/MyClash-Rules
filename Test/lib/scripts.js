'use strict';

/**
 * 当前仓库中实际维护的通用脚本测试对象。
 * Combo 是从 Go 主脚本生成的个人变体，使用专门的隐私防护回归套件验证，
 * 不套用要求所有策略组都进入 GLOBAL 的通用集成断言。
 */
const SCRIPTS = [
  {
    file: 'Script/mihomoScriptGo.js',
    label: 'Go 主脚本 mihomoScriptGo.js',
    meta: {
      full: true,
      regions: ['香港', '日本', '美国', '新加坡', '台湾省'],
    },
  },
];

/** 脚本文件路径列表（供兼容性检查模块使用） */
const SCRIPT_FILES = SCRIPTS.map((s) => s.file);

module.exports = { SCRIPTS, SCRIPT_FILES };
