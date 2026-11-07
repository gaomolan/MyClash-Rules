// ============================================================
// 变体生成器：以 mihomoScriptGo.js 为唯一源，套用 variant-layers
// 中的差异层，生成 combo 变体。请勿直接编辑生成物——改动应落在
// Go 主版（共享改动）或对应差异层（变体专属改动）。
//
// 用法：在仓库根目录执行 `node Script/build-variants.js`
// 机制：每层是一组带上下文锚点的 find/replace 操作，自底向上
// 依次应用；任一锚点在源文件中找不到或不唯一都会报错停机，
// 绝不静默生成。生成后逐文件做语法解析校验。
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptDir = __dirname;
const sourceName = 'mihomoScriptGo.js';
const source = fs.readFileSync(path.join(scriptDir, sourceName), 'utf8');

const targets = [{ layer: 'combo', out: 'mihomoScriptGo-combo.js' }];

function applyLayer(sourceText, layer) {
  let text = sourceText;
  // 自底向上应用，避免上方改动污染下方锚点的上下文
  for (let i = layer.ops.length - 1; i >= 0; i--) {
    const op = layer.ops[i];
    const first = text.indexOf(op.find);
    if (first < 0 || text.indexOf(op.find, first + 1) >= 0) {
      throw new Error(
        `层 ${layer.variant} 第 ${i + 1}/${layer.ops.length} 个操作锚点失效（找不到或不唯一）：` +
          JSON.stringify(op.find.slice(0, 80)),
      );
    }
    text = text.slice(0, first) + op.replace + text.slice(first + op.find.length);
  }
  return text;
}

// 两阶段：先把全部目标生成并校验完毕，再统一写盘——
// 任一层中途失败都不会留下新旧混合的文件状态。
const outputs = [];
for (const t of targets) {
  const layer = JSON.parse(fs.readFileSync(path.join(scriptDir, 'variant-layers', `${t.layer}.json`), 'utf8'));
  const out = applyLayer(source, layer);
  new vm.Script(out, { filename: t.out }); // 语法校验，失败即抛错
  outputs.push({ ...t, content: out, opCount: layer.ops.length });
}
for (const o of outputs) {
  fs.writeFileSync(path.join(scriptDir, o.out), o.content);
  console.log(`已生成 ${o.out}（层 ${o.layer}，${o.opCount} 个操作）`);
}
console.log('完成：变体已由 mihomoScriptGo.js 重新生成。');
