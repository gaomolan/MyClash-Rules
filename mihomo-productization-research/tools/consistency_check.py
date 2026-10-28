#!/usr/bin/env python3
# 一致性检查：Mihomo 产品化研究档案（结项修订用，可重复执行）
# 用法：python3 tools/consistency_check.py [档案根目录]
# 退出码：0=全部通过，1=存在失败项。所有结论均来自实际文件读取。
import csv, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results = []
def check(cid, name, ok, detail):
    results.append((cid, name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {cid} {name} :: {detail}")
def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def read_csv(p):
    with open(os.path.join(ROOT, p), newline='', encoding='utf-8') as f: return list(csv.reader(f))

# ---- C1 来源登记：行数/唯一ID/分段连续性 + 文档口径一致 ----
rows = read_csv('evidence/SOURCE_REGISTER.csv')
data = rows[1:]
ids = [r[0] for r in data]
BANDS = [(1,9),(101,107),(201,219),(301,313),(401,420),(451,458),(461,470),(501,505),
         (551,556),(601,608),(701,720),(801,814),(901,906),(951,964),(1001,1024),
         (1101,1115),(1201,1230),(1301,1322),(1401,1407)]
nums = sorted(int(i.split('-')[1]) for i in ids)
band_ok, band_detail = True, []
for lo, hi in BANDS:
    have = [n for n in nums if lo <= n <= hi]
    expect = list(range(lo, hi+1))
    if have != expect:
        band_ok = False; band_detail.append(f"段{lo}-{hi}缺{[n for n in expect if n not in have]}")
actual_src = len(data)
check('C1a', '来源登记行数=唯一ID数', actual_src == len(set(ids)), f"行数 {actual_src}，唯一 ID {len(set(ids))}，末号 {ids[-1]}")
check('C1b', '来源编号分段连续（按 WP 分配段）', band_ok, '全部分段连续' if band_ok else '; '.join(band_detail))
for doc in ['09-final/EXECUTIVE_DECISION_REPORT.md', '00-management/STATUS_REPORT.md']:
    txt = read(doc)
    claims = [int(x) for x in re.findall(r'来源 (\d+) 条', txt)] + [int(x) for x in re.findall(r'累计 (\d+) 条', txt)]
    bad = [c for c in claims if c != actual_src]
    check('C1c', f'{os.path.basename(doc)} 来源口径={actual_src}', not bad, f"文中总数表述 {claims}，不符 {bad}")

# ---- C2 实验日志 ----
erows = read_csv('07-validation/experiment_log.csv')
edata = erows[1:]
actual_exp = len(edata)
r010 = {r[0]: r for r in edata if r[0].startswith('EXP-R010')}
check('C2a', '实验日志行数', actual_exp == 27, f"实际 {actual_exp} 条（24 生成级 + EXP-R010 3 条）")
check('C2b', 'EXP-R010 三条齐备', set(r010) == {'EXP-R010-01','EXP-R010-02','EXP-R010-03'}, f"实有 {sorted(r010)}")
adj = read('03-technical-research/r010_adjudication.md')
check('C2c', '裁决报告标注 R010 实验性质（内核加载实测）', ('内核' in adj and '加载' in adj and 'E4' in adj), 'r010_adjudication.md 含 E4/内核加载表述' if 'E4' in adj else '缺失')
for doc in ['09-final/EXECUTIVE_DECISION_REPORT.md', '00-management/STATUS_REPORT.md']:
    txt = read(doc)
    okd = ('运行时实验 0 条' not in txt) and ('端到端流量运行时实验' in txt)
    check('C2d', f'{os.path.basename(doc)} 运行时口径已限定', okd, '限定表述在位且无未限定旧表述' if okd else '口径未达标')

# ---- C3 R-010 / DC-02 状态一致 ----
risk = read_csv('00-management/RISK_REGISTER.csv')
r010row = [r for r in risk[1:] if r[0] == 'R-010'][0]
check('C3a', '风险登记 R-010 已裁决-关闭', '已裁决' in r010row[-2] or '已裁决' in ''.join(r010row), f"状态列={r010row[-2]}")
stale = ['R-010（严重未裁决）', '语义冲突（未裁决）', 'R-010 的根源']
for doc in ['09-final/EXECUTIVE_DECISION_REPORT.md', '09-final/RISK_AND_OPEN_QUESTIONS.md', '00-management/STATUS_REPORT.md']:
    txt = read(doc)
    hit = [s for s in stale if s in txt]
    check('C3b', f'{os.path.basename(doc)} 无 R-010 过时状态', not hit, f"命中过时表述 {hit}" if hit else '干净')
dc = read('08-roadmap/decision_checklist.md')
check('C3c', '拍板清单 DC-02 已标记拍板结论', '已拍板' in dc and 'DC-02' in dc, '含已拍板标记' if '已拍板' in dc else '未标记')
declog = read('00-management/DECISION_LOG.md')
check('C3d', '决策日志含 D-009（DC-01 暂缓）与 D-010（DC-02 拍板）', 'D-009' in declog and 'D-010' in declog, '齐备' if ('D-009' in declog and 'D-010' in declog) else '缺失')

# ---- C4 ISSUE-003 状态一致 ----
ilog = read_csv('00-management/ISSUE_BLOCKER_LOG.csv')
i3 = [r for r in ilog[1:] if r[0] == 'ISSUE-003'][0]
check('C4a', '问题登记 ISSUE-003 已关闭', 'CLOSED' in ''.join(i3), f"状态={i3[7]}")
for doc in ['00-management/STATUS_REPORT.md', '09-final/EXECUTIVE_DECISION_REPORT.md']:
    txt = read(doc)
    okb = ('待点按' not in txt) and ('点按一次后补采' not in txt)
    check('C4b', f'{os.path.basename(doc)} 无「待点按后补采」过时指引', okb, '干净' if okb else '仍有过时指引')

# ---- C5 审计条件 A-01~A-03 处置工件 ----
trows = read_csv('00-management/TASK_REGISTER.csv')
ei = trows[0].index('evidence_refs')
empty_refs = [r[0] for r in trows[1:] if not r[ei]]
check('C5a', 'A-02：台账 evidence_refs 无空缺', not empty_refs, f"空缺 {empty_refs}" if empty_refs else '18 行全有')
q = read('00-management/QUALITY_GATE_CHECKLIST.md')
check('C5b', 'A-03：质量门禁无未勾选项', '- [ ]' not in q, f"已勾 {q.count('- [x]')}，未勾 {q.count('- [ ]')}")
st = read('00-management/STATUS_REPORT.md')
check('C5c', 'A-01：终局状态报告存在且标明最终状态', 'COMPLETED_IN_DRIVE' in st, '含 COMPLETED_IN_DRIVE' if 'COMPLETED_IN_DRIVE' in st else '缺失')

# ---- C6 关键文件存在性 ----
KEY = ['09-final/EXECUTIVE_DECISION_REPORT.md','09-final/FULL_RESEARCH_REPORT.md','09-final/TECHNICAL_FINDINGS.md',
 '09-final/ARCHITECTURE_RECOMMENDATION.md','09-final/RISK_AND_OPEN_QUESTIONS.md','09-final/NEXT_PHASE_BACKLOG.md',
 '09-final/FINAL_QA_REPORT.md','09-final/audit_report.md','09-final/AUDIT_CLOSURE_ADDENDUM.md',
 '09-final/CLOSURE_REVISION_REPORT.md','03-technical-research/r010_adjudication.md',
 '00-management/TASK_REGISTER.csv','00-management/RISK_REGISTER.csv','00-management/ISSUE_BLOCKER_LOG.csv',
 '00-management/DECISION_LOG.md','00-management/CHANGE_LOG.md','evidence/SOURCE_REGISTER.csv',
 '07-validation/experiment_log.csv','08-roadmap/decision_checklist.md','08-roadmap/next_phase_backlog.csv']
missing = [p for p in KEY if not os.path.exists(os.path.join(ROOT, p))]
check('C6', '关键文件存在性', not missing, f"缺失 {missing}" if missing else f'{len(KEY)} 个关键文件齐备')

# ---- C7 Backlog 状态注记 ----
bl = read('08-roadmap/next_phase_backlog.csv')
for bid, kw in [('BL-003','已销账（2026-10-28'), ('BL-104','EXP-R010-01~03'), ('BL-207','DC-02 已拍板（D-010）')]:
    row = [l for l in bl.splitlines() if l.startswith(bid+',')]
    ok = bool(row) and kw in row[0]
    check('C7', f'Backlog {bid} 含状态注记「{kw}」', ok, '已注记' if ok else '未注记')

fails = [r for r in results if not r[2]]
print(f"\n总计 {len(results)} 项：PASS {len(results)-len(fails)}，FAIL {len(fails)}")
sys.exit(1 if fails else 0)
