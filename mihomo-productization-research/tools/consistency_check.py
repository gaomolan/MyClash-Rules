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
check('C5a', 'A-02：台账 evidence_refs 无空缺', not empty_refs, f"空缺 {empty_refs}" if empty_refs else f'{len(trows)-1} 行全有')
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


# ---- C8 风险状态语义（解析登记册状态字段，与报告汇总数字对账） ----
rrows = read_csv('00-management/RISK_REGISTER.csv')
rhdr = rrows[0]
si_risk = rhdr.index('status')
closed_ids, open_ids = [], []
for r in rrows[1:]:
    st = r[si_risk]
    if ('关闭' in st) or ('已裁决' in st):
        closed_ids.append(r[0])
    elif '开放' in st:
        open_ids.append(r[0])
n_total, n_open, n_closed = len(rrows) - 1, len(open_ids), len(closed_ids)
check('C8a', '风险登记册状态解析', n_total == n_open + n_closed and n_closed >= 1,
      f"总数 {n_total}，开放 {n_open}，关闭 {n_closed}（{closed_ids}）")
RISK_DOCS = ['09-final/EXECUTIVE_DECISION_REPORT.md', '09-final/RISK_AND_OPEN_QUESTIONS.md',
             '09-final/FULL_RESEARCH_REPORT.md', '00-management/STATUS_REPORT.md',
             '09-final/CLOSURE_REVISION_REPORT.md']
# 逐行语境扫描仅适用于现行状态文档；修订报告等历史记录类文件必然引用旧表述，不纳入逐行扫描（数字口径仍查）
LINE_DOCS = RISK_DOCS[:4]
for doc in RISK_DOCS:
    txt = read(doc)
    problems = []
    if n_closed > 0 and doc in LINE_DOCS:  # 短语禁查仅限现行状态文档；历史记录类文件（含修订报告）必然引用旧表述，只查其数字口径
        for phrase in ['全部开放', '全数开放', '均开放', '全部为开放状态']:
            if phrase in txt: problems.append(f"含过时表述「{phrase}」")
    for m in re.finditer(r'开放[^，。；\n]{0,10}?(\d+)\s*[条项]', txt):
        if int(m.group(1)) != n_open: problems.append(f"开放计数 {m.group(1)} ≠ {n_open}")
    for m in re.finditer(r'(\d+)\s*条[^，。；\n]{0,6}开放', txt):
        if int(m.group(1)) != n_open: problems.append(f"开放计数 {m.group(1)} ≠ {n_open}")
    for m in re.finditer(r'(?<!开放)风险 (\d+) 条', txt):
        if int(m.group(1)) != n_total: problems.append(f"风险总数 {m.group(1)} ≠ {n_total}")
    if doc in LINE_DOCS:
        for cid in closed_ids:
            for ln, line in enumerate(txt.split('\n'), 1):
                if cid in line and '开放' in line and not any(k in line for k in ['已裁决', '已关闭', '关闭）', '关闭，', '关闭。']):
                    problems.append(f"L{ln} 已关闭的 {cid} 出现在开放语境且无关闭标注")
    check('C8b', f'{os.path.basename(doc)} 风险汇总与登记册一致', not problems, '; '.join(problems[:3]) if problems else f"开放 {n_open}/总 {n_total} 口径一致，已关闭项无混入")

# ---- C9 决策依赖语义（解析决策日志/拍板清单状态，与路线图及 Backlog 前置对账） ----
declog = read('00-management/DECISION_LOG.md')
def dblock(tag):
    m = re.search(rf'## {tag}\b', declog)
    if not m: return ''
    rest = declog[m.start():]
    nxt = rest.find('\n## ', 3)
    return rest if nxt < 0 else rest[:nxt]
d9, d10 = dblock('D-009'), dblock('D-010')
check('C9a', '决策日志 D-009=DC-01 暂缓 / D-010=DC-02 拍板', ('DC-01' in d9 and '暂缓' in d9) and ('DC-02' in d10 and ('拍板' in d10 or '选定' in d10)),
      '两条决策语义在位' if (('DC-01' in d9 and '暂缓' in d9) and ('DC-02' in d10)) else '决策语义缺失')
dc = read('08-roadmap/decision_checklist.md')
secs = re.split(r'### (DC-\d+)', dc)
secmap = {secs[i]: secs[i+1] for i in range(1, len(secs) - 1, 2)}
s1 = secmap.get('DC-01', ''); s2 = secmap.get('DC-02', '')
check('C9b', '拍板清单 DC-01=暂缓（非通过）/ DC-02=已拍板',
      ('暂缓' in s1 and '已拍板' not in s1) and ('已拍板' in s2),
      f"DC-01 段含暂缓={'暂缓' in s1}、误标已拍板={'已拍板' in s1}；DC-02 段含已拍板={'已拍板' in s2}")
RESOLVED = ['已拍板', '已定', 'D-010', '已决', '已裁决', '已销账']
PENDING = ['待', '先决', '未决']
# C9c：状态性文档中 DC-01 不得被标为已通过（路线图阶段进入条件为条件句，不在此列）
for doc in ['09-final/EXECUTIVE_DECISION_REPORT.md', '00-management/STATUS_REPORT.md', '08-roadmap/next_phase_backlog.csv']:
    txt = read(doc)
    bad = []
    for m in re.finditer(r'DC-01[^。\n]{0,24}?(已拍板|已通过|已确认)', txt):
        seg = txt[max(0, m.start()-6):m.end()]
        if not any(k in seg for k in ['未', '暂缓', '不']):
            bad.append(m.group(0)[:30])
    check('C9c', f'{os.path.basename(doc)} 未把 DC-01 误标为已通过', not bad, f"命中 {bad}" if bad else '干净')
# C9d：已完成决策（DC-02）不得仍被当作待决前置
dep_problems = []
bl_rows = read_csv('08-roadmap/next_phase_backlog.csv')
for r in bl_rows[1:]:
    for fld in [r[1], r[5], r[6]]:
        if 'DC-02' in fld and not any(k in fld for k in RESOLVED) and any(k in fld for k in PENDING + ['拍板']):
            dep_problems.append(f"{r[0]} 字段仍以待决口径引用 DC-02：{fld[:36]}")
for doc in ['08-roadmap/implementation_roadmap.md', '09-final/NEXT_PHASE_BACKLOG.md']:
    for ln, line in enumerate(read(doc).split('\n'), 1):
        for seg in re.split(r'[；。]', line):
            if 'DC-02' in seg and not any(k in seg for k in RESOLVED) and any(k in seg for k in PENDING + ['先决']):
                dep_problems.append(f"{os.path.basename(doc)} L{ln} 仍以待决口径引用 DC-02：{seg[:36]}")
check('C9d', '无任务/路线图条目仍把已拍板的 DC-02 当待决前置', not dep_problems, '; '.join(dep_problems[:3]) if dep_problems else '全部 DC-02 引用均带已决标记或不构成等待')
bl001 = [r for r in bl_rows[1:] if r[0] == 'BL-001']
check('C9e', 'BL-001 已吸收 DC-02 已定状态', bool(bl001) and any('D-010' in f or '已拍板' in f for f in bl001[0]),
      'BL-001 含已决标记' if (bl001 and any('D-010' in f or '已拍板' in f for f in bl001[0])) else 'BL-001 仍按双待决书写')



# ---- C9f 并列决策过期状态（DC-01/DC-02 被并列书写为均未决） ----
JOINT_PENDING = ['不决', '未决', '待拍板', '先决', '均待']
DIFFERENTIATED = ['已拍板', 'D-010', '暂缓', '已决']
joint_problems = []
for doc in ['09-final/NEXT_PHASE_BACKLOG.md', '08-roadmap/implementation_roadmap.md',
            '09-final/EXECUTIVE_DECISION_REPORT.md', '00-management/STATUS_REPORT.md']:
    for ln, line in enumerate(read(doc).split('\n'), 1):
        for seg in re.split(r'[；。]', line):
            joint = ('DC-01/DC-02' in seg) or ('DC-01' in seg and 'DC-02' in seg)
            if joint and any(k in seg for k in JOINT_PENDING) and not any(k in seg for k in DIFFERENTIATED):
                joint_problems.append(f"{os.path.basename(doc)} L{ln}：{seg.strip()[:44]}")
check('C9f', '无并列决策（DC-01/DC-02）均未决的过期表述', not joint_problems,
      '; '.join(joint_problems[:3]) if joint_problems else '并列引用均已区分状态（DC-02 已拍板 / DC-01 暂缓）')

fails = [r for r in results if not r[2]]
print(f"\n总计 {len(results)} 项：PASS {len(results)-len(fails)}，FAIL {len(fails)}")
sys.exit(1 if fails else 0)
