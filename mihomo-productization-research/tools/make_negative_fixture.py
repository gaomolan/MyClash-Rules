#!/usr/bin/env python3
# 负向测试构造器：从真实档案复制一份到临时目录，故意注入两类语义矛盾，
# 再对副本运行 tools/consistency_check.py，证明检查能捕获矛盾。
# 真实档案只读不写；副本位于系统临时目录，运行后自动删除。
# 用法：python3 tools/make_negative_fixture.py [档案根目录]
import os, shutil, subprocess, sys, tempfile

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
fx = tempfile.mkdtemp(prefix='neg_fixture_')
assert os.path.commonpath([fx]) != os.path.commonpath([ROOT]) and ROOT not in fx
def ignore(dirpath, names):
    return [n for n in names if n.startswith('_work') or n == '.git']
shutil.copytree(ROOT, fx, dirs_exist_ok=True, ignore=ignore)

def mutate(rel, old, new):
    p = os.path.join(fx, rel)
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, f"fixture anchor fail: {rel}"
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print(f"注入矛盾 → {rel}：{new[:44]}")

print(f"负向样例目录（临时）：{fx}")
# M1 风险状态矛盾：把已关闭的 R-010 混回开放集合并篡改开放计数；标题改回全开放口径
mutate('00-management/STATUS_REPORT.md', 'R-010 已裁决-关闭，其余 11 条开放并有承接任务', 'R-010，其余 12 条开放并有承接任务')
mutate('09-final/EXECUTIVE_DECISION_REPORT.md', '## 4. 风险概览（登记 12 项，开放 11 项）', '## 4. 风险概览（12 项，全部开放）')
# M2 决策依赖矛盾：把 BL-207 的已定前置改回「等待 DC-02 拍板」
mutate('08-roadmap/next_phase_backlog.csv', 'BL-104（事实面已裁决）、DC-02 已拍板（D-010）', 'BL-104、DC-02 拍板（BL-001）')
mutate('08-roadmap/next_phase_backlog.csv', '按 DC-02 已拍板（D-010）改法实现', '按 DC-02 拍板后选定改法实现')

print("\n--- 对负向样例运行一致性检查（预期失败） ---")
r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'consistency_check.py'), fx],
                   capture_output=True, text=True)
print(r.stdout)
fails = [l for l in r.stdout.splitlines() if l.startswith('[FAIL]')]
hit_risk = any('C8' in l for l in fails)
hit_dep = any('C9' in l for l in fails)
print(f"--- 负向测试判定：退出码 {r.returncode}；FAIL {len(fails)} 项；命中风险类矛盾(C8)={hit_risk}，命中决策依赖矛盾(C9)={hit_dep}")
verdict = (r.returncode != 0 and hit_risk and hit_dep)
print("负向测试结论：", "通过（检查成功捕获两类注入矛盾）" if verdict else "失败（检查未能捕获注入矛盾！）")
shutil.rmtree(fx)
print("临时样例已删除，真实档案未被触碰。")
sys.exit(0 if verdict else 1)
