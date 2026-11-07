#!/usr/bin/env node
// 선택지 ↔ 제도(원고) 연결 · 필터링 자동 검사
//
//   npm run check:links            빌드 전 자동 실행. '오류'만 빌드를 멈추고, 연결 공백은 건수만 알려 줌
//   npm run audit:links            + 전체 표를 reports/link-audit.local.md · .json 에 씀 (원자료 포함 → 저장소에 올리지 않음)
//   --verbose                      경고를 모두 화면에 출력
//
// 검사 항목 (번호는 요청서 5번 항목)
//  1. 어떤 선택지와도 연결되지 않은 제도(원고)
//  2. 없는 목표·선택지·원고 ID를 참조하는 연결                      → 오류
//  3. 자격조건(conditions·eligibility)이 없는 원고
//  4. 공식 출처 또는 확인일이 없는 원고
//  5. 여러 조건을 골랐을 때 잘못 '불일치'로 판정되는 원고          → 오류 (판정 규칙 결함)
//  6. 단기·장기 분류와 연결 선택지·내용이 맞지 않는 항목
//  7. 지역·나이를 답하지 않았을 때 결과가 사라지거나 불일치가 되는 경우 → 오류
//  8. 원자료에 있지만 질문 화면에서 찾을 수 없는 제도
//
// 읽는 곳: content/*.json(+drafts/), src/data/content/*.json(내보내기 결과, 있으면), .env.local 의 RAWDATA_DIR(있으면)
// 판정 규칙은 화면과 같은 src/data/matching.ts 를 그대로 불러 씀 (Node 22.18+ 타입 제거 실행)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goalIndex, optionKey, linkReason, linkedFor, eligibility, flagsFrom, personalize, hasConditions } from '../src/data/matching.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');
const VERBOSE = process.argv.includes('--verbose');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const errors = [];
const warn = { 1: [], 3: [], 4: [], 6: [], 8: [], gap: [], info: [] };

// ── 질문·선택지 (src/data/v05/case_questionnaires.json, questionnaire.ts 와 같은 ID 규칙)
const Q = readJson(join(ROOT, 'src/data/v05/case_questionnaires.json')).caseDefinitions;
const QKEY = { 'domestic-violence': 'domestic_violence', 'sexual-violence': 'sexual_violence', 'family-care': 'family_care', 'livelihood-education': 'livelihood_education' };
const CASE_LABEL = { 'domestic-violence': '가정폭력', 'sexual-violence': '성폭력', 'family-care': '가족돌봄', 'livelihood-education': '생계·교육', 'reclusive-youth': '은둔 청년' };
const HZ = ['short-term', 'long-term'];
const HZ_LABEL = { 'short-term': '단기', 'long-term': '장기' };
const OPTIONS = new Map(); // key → { c, h, id, group, label }
const flowGroups = {}; // `${c}/${h}` → Set(groupId)
for (const [c, k] of Object.entries(QKEY)) {
  const d = Q[k];
  for (const h of HZ) {
    const groups = h === 'short-term' ? (d.short.help_options ? [{ id: 'help', label: '도움 목록', options: d.short.help_options }] : d.short.help_groups) : d.long.questions.find((q) => q.groups)?.groups ?? [];
    flowGroups[`${c}/${h}`] = new Set(groups.map((g) => g.id));
    groups.forEach((g) => g.options.forEach((label, i) => {
      const id = `${g.id}.${i + 1}`;
      OPTIONS.set(optionKey(c, h, id), { c, h, id, group: g.label, label });
    }));
    // 조건부 질문이 이 기간에 없는 분야를 가리키면 그 질문은 영영 안 보임
    const qs = h === 'short-term' ? d.short.quick_questions : d.long.questions;
    for (const q of qs) for (const g of q.conditionalOn ?? []) {
      if (!flowGroups[`${c}/${h}`].has(g)) warn[6].push(`질문 ${CASE_LABEL[c]} ${HZ_LABEL[h]} "${q.id}"(${q.title})의 표시 조건 "${g}"는 이 기간의 지원 분야에 없어요 → 그 분야를 골라도 질문이 열리지 않음 (원본 case_questionnaires.json, 운영자 결정 필요)`);
    }
  }
}

// ── 목표 연결표
const goalsFile = readJson(join(ROOT, 'src/data/goals.json'));
const GOALS = goalsFile.goals;
const goalById = new Map(GOALS.map((g) => [g.id, g]));
const idx = goalIndex(GOALS);
const seenGoal = new Set();
for (const g of GOALS) {
  if (seenGoal.has(g.id)) errors.push(`[2] goals.json: 목표 ID "${g.id}"가 두 번 있어요`);
  seenGoal.add(g.id);
  (g.fields ?? []).filter((f) => !goalsFile.fields[f]).forEach((f) => errors.push(`[2] goals.json "${g.id}": 지원 분야 "${f}"가 fields 에 없어요`));
  g.options.filter((k) => !OPTIONS.has(k)).forEach((k) => errors.push(`[2] goals.json "${g.id}": 선택지 "${k}"는 질문에 없어요 (질문 순서가 바뀌어 ID가 밀렸는지 확인)`));
}
// 목표가 하나도 없는 선택지
for (const [k, o] of OPTIONS) if (!idx.has(k)) warn.gap.push(`선택지 ${k} "${o.label}"에 연결된 해결 목표가 없어요`);

// ── 원고 모으기
const items = new Map(); // id → 정규화 원고 (먼저 넣은 쪽 우선: content/ → 원자료 → 내보내기 결과)
const norm = (x) => ({ helpOptions: [], goals: [], needs: [], costValues: [], evidence: [], ...x });
function addItem(it) { if (!items.has(it.id)) items.set(it.id, norm(it)); }

const CONTENT_DIR = join(ROOT, 'content');
const listJson = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')) : []);
for (const [dir, draft] of [[CONTENT_DIR, false], [join(CONTENT_DIR, 'drafts'), true]]) {
  for (const f of listJson(dir)) {
    const data = readJson(join(dir, f));
    for (const e of data.items ?? []) addItem({
      id: e.id, kind: e.kind, horizon: e.horizon, order: e.order ?? 999, cases: e.cases ?? [data.case], title: e.title, programName: e.programName,
      helpOptions: e.helpOptions ?? [], goals: e.goals ?? [], conditions: e.conditions, eligibility: e.eligibility, needs: e.needs ?? [],
      costValues: (e.costs ?? []).map((c) => c.value), evidence: (e.sources ?? []).map((s) => s.url), checkedAt: e.checkedAt ?? null,
      draft, src: `content/${draft ? 'drafts/' : ''}${f}`, userFacing: true,
    });
  }
}

// 원자료 (선택)
function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
const env = { ...readEnvFile(join(ROOT, '.env.local')), ...process.env };
const RAW = env.RAWDATA_DIR && existsSync(env.RAWDATA_DIR) ? env.RAWDATA_DIR : null;
const linkMap = readJson(join(ROOT, 'scripts/link-map.json'));
const stageMap = readJson(join(ROOT, 'scripts/stage-map.json'));
const stepOrder = readJson(join(ROOT, 'scripts/step-order.json')).order;
for (const [id, gs] of Object.entries(linkMap)) {
  if (id.startsWith('$')) continue;
  gs.filter((g) => !goalById.has(g)).forEach((g) => errors.push(`[2] scripts/link-map.json "${id}": 목표 "${g}"가 goals.json 에 없어요`));
}

let rawStats = null;
const researchNotes = [];
if (RAW) {
  const load = (rel) => readJson(join(RAW, rel));
  const status = load('04_ContentEditing/json/CurrentContentStatus.json');
  const drafts = new Map(load('04_ContentEditing/json/ContentDrafts.json').map((d) => [d.record_id, d]));
  const ev = new Map([...load('02_Agent02_사실검증/json/Evidence.json'), ...load('02_Agent02_사실검증/json/NewEvidence.json')].map((e) => [e.record_id, e]));
  const KIND = { FAQ: 'faq', FAQ_DRAFT: 'faq', Guide: 'guide', MAIN_CONTENT_DRAFT: 'guide' };
  for (const s of status) {
    const d = drafts.get(s.record_id) ?? {};
    if (!KIND[s.content_type]) { researchNotes.push({ id: s.record_id, title: s.title, type: s.content_type, cases: d.case_ids ?? [] }); continue; }
    const horizon = d.journey_stage || stageMap[s.record_id] || null;
    if (d.journey_stage && stageMap[s.record_id] && d.journey_stage !== stageMap[s.record_id]) warn[6].push(`${s.record_id}: 원자료 journey_stage(${d.journey_stage})와 scripts/stage-map.json(${stageMap[s.record_id]})이 달라요`);
    const evs = (d.evidence_ids ?? s.evidence_ids ?? []).map((i) => ev.get(i)).filter(Boolean);
    addItem({
      id: s.record_id, kind: KIND[s.content_type], horizon, order: stepOrder.includes(s.record_id) ? stepOrder.indexOf(s.record_id) : 999,
      cases: d.case_ids ?? [], title: s.title, goals: linkMap[s.record_id] ?? [], conditions: undefined, eligibility: undefined,
      costValues: [], evidence: evs.map((e) => e.resolved_url || e.source_url).filter(Boolean),
      checkedAt: evs.map((e) => (e.checked_at || e.last_checked_at || '').slice(0, 10)).filter(Boolean).sort().at(-1) ?? null,
      draft: !(s.publish_allowed === true && s.operator_decision === 'APPROVED' && s.approved_hash && s.approved_hash === s.content_hash),
      verification: s.verification_status ?? d.verification_status, src: 'rawdata ContentDrafts', userFacing: true, raw: true,
    });
  }
  for (const id of Object.keys(linkMap)) if (!id.startsWith('$') && !status.some((s) => s.record_id === id)) warn.info.push(`scripts/link-map.json 의 "${id}"는 원자료에 없어요`);
  // Programs: 대량 수집 후보 (케이스·검증 없음) — 경로 조사용 검색에만 씀
  const programs = load('02_Agent02_사실검증/json/Programs.json');
  rawStats = {
    programs: programs.length,
    programNames: new Set(programs.map((p) => p.name)).size,
    programsWithCase: programs.filter((p) => (p.case_ids ?? []).length).length,
    programsVerified: programs.filter((p) => p.verification_status === 'VERIFIED' || p.publish_allowed === true).length,
    contentRecords: status.length,
  };
  for (const g of GOALS) for (const pw of g.pathways ?? []) {
    const hits = pw.keywords.length ? programs.filter((p) => pw.keywords.some((k) => (p.name ?? '').includes(k))) : [];
    pw.rawHits = hits.length;
    pw.rawNames = [...new Set(hits.map((p) => p.name))].length;
    pw.samples = hits.slice(0, 4).map((p) => `${p.name} (${p.record_id}${p.operator_candidate ? ` · ${p.operator_candidate}` : ''})`);
  }
}
// 내보내기 결과 (원자료 경로가 없을 때 대신)
for (const f of ['published.json', 'drafts.local.json']) {
  const p = join(ROOT, 'src/data/content', f);
  if (!existsSync(p)) continue;
  for (const i of readJson(p)) addItem({
    id: i.id, kind: i.kind, horizon: i.horizon, order: i.order, cases: i.cases, title: i.title, programName: i.programName,
    helpOptions: i.helpOptions ?? [], goals: i.goals ?? linkMap[i.id] ?? [], conditions: i.conditions, eligibility: i.eligibility, needs: i.needs ?? [],
    costValues: (i.editorial?.costs ?? []).map((c) => c.value), evidence: (i.evidence ?? []).map((e) => e.url), checkedAt: i.checkedAt,
    mergedInto: i.mergedInto, draft: i.draft, src: `src/data/content/${f}`, userFacing: true,
  });
}

// ── 원고별 검사
const ALL = [...items.values()];
const rows = [];
const LONG_WORDS = /임금|월급|근무시간|취업|일자리|학업|소송|이혼|양육권|자립|직업훈련/;
const SHORT_WORDS = /긴급|야간|응급|즉시|당장|오늘|72시간|120시간/;
for (const it of ALL) {
  const at = `${it.id} (${it.src})`;
  // 2. 없는 ID
  it.goals.filter((g) => !goalById.has(g)).forEach((g) => errors.push(`[2] ${at}: 목표 "${g}"가 goals.json 에 없어요`));
  for (const o of it.helpOptions) if (!it.cases.some((c) => OPTIONS.has(optionKey(c, it.horizon, o))) && !/\.none$/.test(o)) errors.push(`[2] ${at}: helpOptions "${o}"는 이 케이스·기간 질문에 없어요`);
  // 연결된 선택지 (화면 규칙 그대로: 단계 카드·같은 케이스·같은 기간)
  const linked = [], sameGoalOtherHorizon = [], otherCases = new Set();
  for (const [k, o] of OPTIONS) {
    const r = linkReason(it, idx, o.c, o.h, o.id);
    if (!r.linked) continue;
    if (o.h !== it.horizon) { sameGoalOtherHorizon.push(k); continue; }
    if (!it.cases.includes(o.c)) { otherCases.add(o.c); continue; }
    linked.push(k);
  }
  const shown = it.kind === 'guide' && !it.mergedInto ? linked : [];
  const issues = [];
  // 1·8. 연결 없음
  if (!it.horizon) issues.push('단기·장기 구분 없음 → 화면에 안 나옴');
  if (!it.goals.length && !it.helpOptions.length) issues.push('선택지·목표 연결 없음');
  else if (!linked.length) issues.push(sameGoalOtherHorizon.length ? `연결 목표가 ${HZ_LABEL[it.horizon === 'short-term' ? 'long-term' : 'short-term']} 선택지에만 있음` : '이 케이스의 선택지와 연결 안 됨');
  if (it.kind === 'faq' && linked.length) issues.push('FAQ는 선택지 아래가 아니라 페이지 FAQ 영역에 노출 (선택지 결과는 단계 카드만)');
  if (it.mergedInto) issues.push(`${it.mergedInto} 카드에 합쳐져 그 카드로 노출`);
  if (!shown.length) (it.raw ? warn[8] : warn[1]).push(`${at}: 질문 화면 선택지 아래에서 찾을 수 없어요 — ${issues.join(' / ') || 'FAQ'}`);
  if (otherCases.size) warn.info.push(`${at}: 같은 목표의 ${[...otherCases].map((c) => CASE_LABEL[c]).join('·')} 선택지에도 맞을 수 있어요 — 대상이 맞으면 "cases"에 추가`);
  // 3. 자격조건
  if (!hasConditions(it.conditions) && !it.eligibility) { issues.push('자격조건 없음'); warn[3].push(`${at}: 공식 자격조건(conditions·eligibility)이 없어요 → 항상 '추가 확인 필요'`); }
  // 4. 출처·확인일
  if (!it.evidence.length) { issues.push('공식 출처 없음'); warn[4].push(`${at}: 공식 출처가 없어요`); }
  if (!it.checkedAt) { issues.push('확인일 없음'); warn[4].push(`${at}: 확인일(검증일)이 없어요`); }
  else if (it.checkedAt > today) errors.push(`[4] ${at}: 확인일 ${it.checkedAt}이 오늘보다 뒤예요`);
  // 6. 단기·장기 ↔ 내용
  if (it.horizon === 'short-term' && LONG_WORDS.test(it.title)) { issues.push('제목이 장기 성격일 수 있음'); warn[6].push(`${at}: 단기인데 제목 "${it.title}"에 장기 성격 낱말이 있어요 — 분류 확인 권장`); }
  if (it.horizon === 'long-term' && SHORT_WORDS.test(it.title)) { issues.push('제목이 단기 성격일 수 있음'); warn[6].push(`${at}: 장기인데 제목 "${it.title}"에 단기 성격 낱말이 있어요 — 분류 확인 권장`); }
  if (sameGoalOtherHorizon.length && !linked.length) warn[6].push(`${at}: ${HZ_LABEL[it.horizon]} 원고인데 연결 목표는 다른 기간 선택지에만 있어요 (${sameGoalOtherHorizon.slice(0, 3).join(', ')}…)`);
  if (it.verification && it.verification !== 'VERIFIED') issues.push(`검증 상태 ${it.verification}`);
  if (it.draft) issues.push('공개 전(초안)');

  // 5·7. 판정 규칙 시뮬레이션 — 답하지 않음·모름·조건에 맞는 답의 모든 조합에서 '불일치'가 나오면 안 됨
  const c = it.conditions;
  const empty = eligibility(c, {});
  if (empty.status === 'no') errors.push(`[7] ${at}: 아무것도 답하지 않았는데 '확인된 조건 불일치'가 돼요`);
  if (hasConditions(c)) {
    const parts = [];
    if (c.regions?.length) parts.push((a) => ({ ...a, sido: c.regions[0], sidoSource: 'residence' }));
    if (c.ageMin !== undefined || c.ageMax !== undefined) parts.push((a) => ({ ...a, age: c.ageMin ?? c.ageMax }));
    for (const [q, ls] of Object.entries(c.answers ?? {})) parts.push((a) => ({ ...a, picks: { ...a.picks, [q]: [ls[0], '잘 모르겠어요.'] } }));
    const n = Math.min(parts.length, 8);
    for (let mask = 0; mask < 1 << n; mask++) {
      let a = { picks: {} };
      parts.forEach((fn, i) => { if (mask & (1 << i)) a = fn(a); });
      // 개인화 응답을 모두 켠 상태도 함께 (B는 상태를 바꾸면 안 됨)
      const withFlags = { ...a, picks: { ...a.picks, reporting: ['지금은 신고할 생각이 없어요.'], difficulties: ['필요한 서류가 부족해요.', '연락·방문이 어려워요.', '비용이 부족해요.'] } };
      for (const x of [a, withFlags]) {
        const r = eligibility(c, x);
        if (r.status === 'no') { errors.push(`[5] ${at}: 조건에 맞거나 답하지 않은 조합에서 '불일치'가 돼요 (조합 ${mask})`); break; }
      }
    }
    // 지금 계신 곳(단기)이 조건 지역과 달라도 불일치가 되면 안 됨
    if (c.regions?.length && eligibility(c, { sido: '__other__', sidoSource: 'current' }).status === 'no') errors.push(`[7] ${at}: '지금 계신 곳'만으로 지역 불일치가 돼요`);
    // '모르겠어요'만 고른 조건 질문은 미응답으로
    for (const q of Object.keys(c.answers ?? {})) if (eligibility({ answers: { [q]: c.answers[q] } }, { picks: { [q]: ['잘 모르겠어요.'] } }).status !== 'check') errors.push(`[5] ${at}: "${q}"에 '모르겠어요'만 골랐는데 상태가 '추가 확인 필요'가 아니에요`);
  }
  // B. 개인화는 원고를 지우지 않음 — 연결 목록이 응답과 무관한지 (화면은 빌드 때 카드를 다 그려 두고 숨기지 않음)
  const f = flagsFrom({ reporting: ['지금은 신고할 생각이 없어요.'], difficulties: ['필요한 서류가 부족해요.'] });
  if (!Number.isFinite(personalize(it, f).weight)) errors.push(`[5] ${at}: 개인화 가중치 계산 오류`);

  rows.push({
    id: it.id, name: it.programName ? `${it.programName} — ${it.title}` : it.title,
    cases: it.cases.map((x) => CASE_LABEL[x] ?? x).join(', ') || '없음', horizon: HZ_LABEL[it.horizon] ?? '없음', kind: it.kind,
    goals: it.goals, options: linked, missing: shown.length ? '정상 연결' : '미연결', issues, src: it.src,
  });
}

// 선택지 쪽: 목표는 있지만 실제 원고가 하나도 없는 선택지 (요청 1: '선택지에는 연결되어 있지만 실제 데이터가 없는 항목')
const guides = ALL.filter((i) => i.kind === 'guide');
const optionCoverage = [];
for (const [k, o] of OPTIONS) {
  const got = linkedFor(guides, idx, o.c, o.h, o.id);
  optionCoverage.push({ key: k, ...o, goals: idx.get(k) ?? [], count: got.length, ids: got.map((i) => i.id) });
  if (!got.length) warn.gap.push(`선택지 ${k} "${o.label}": 연결된 원고 없음 → 화면에 '아직 게시 전' 안내만 보임`);
}
// 7. 지역·나이와 무관하게 연결 — 화면은 응답과 상관없이 같은 카드 목록을 그림(정적). 위 시뮬레이션으로 상태만 검사.

// ── 출력
const linkedRows = rows.filter((r) => r.missing === '정상 연결');
const unlinkedRows = rows.filter((r) => r.missing !== '정상 연결');
const coveredOpts = optionCoverage.filter((o) => o.count > 0).length;
const sum = [
  `원고 ${rows.length}건 (질문 화면 연결 ${linkedRows.length} · 미연결 ${unlinkedRows.length})${RAW ? '' : ' — RAWDATA_DIR 없음: 원자료 원고는 내보내기 결과로만 검사'}`,
  `선택지 ${OPTIONS.size}개 중 원고가 하나 이상 연결된 선택지 ${coveredOpts}개, 목표 ${GOALS.length}개`,
  `경고: [1]미연결 ${warn[1].length} · [3]자격조건 없음 ${warn[3].length} · [4]출처·확인일 없음 ${warn[4].length} · [6]기간 확인 ${warn[6].length} · [8]원자료 미노출 ${warn[8].length} · 선택지 공백 ${warn.gap.length}`,
];
if (VERBOSE) for (const [k, list] of Object.entries(warn)) for (const w of list) console.warn(`⚠ [${k}] ${w}`);

if (REPORT) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const md = [];
  md.push(`# 선택지 ↔ 지원제도 연결 검사 (${today})`, '', '> 자동 생성: `npm run audit:links`. 원자료·초안 제목이 들어 있어 **저장소에 올리지 않습니다**(reports/ 는 .gitignore).', '');
  md.push('## 요약', '', ...sum.map((s) => `- ${s}`));
  if (rawStats) md.push(`- 원자료 콘텐츠 원고 ${rawStats.contentRecords}건 (화면용 ${rows.filter((r) => r.src === 'rawdata ContentDrafts').length} · 연구 메모·전문가 검토용 ${researchNotes.length})`,
    `- 원자료 Programs(대량 수집 후보) ${rawStats.programs}건 / 고유 이름 ${rawStats.programNames}개 — 케이스 지정 ${rawStats.programsWithCase}건, 검증·공개 가능 ${rawStats.programsVerified}건 → **질문 화면에 연결할 수 없는 미분류 후보**`);
  md.push('', `## 오류 (${errors.length}건)`, '', ...(errors.length ? errors.map((e) => `- ${esc(e)}`) : ['- 없음']));
  md.push('', '## 1. 제도(원고)별 연결 상태', '', '| 제도 ID | 제도명 | 연결 케이스 | 단기·장기 | 해결 목표 | 연결 선택지 | 누락 여부 | 개선 필요사항 |', '|---|---|---|---|---|---|---|---|');
  for (const r of rows) md.push(`| ${r.id} | ${esc(r.name)} | ${r.cases} | ${r.horizon} | ${r.goals.join(', ') || '—'} | ${r.options.map((k) => k.split('/').slice(1).join('/')).join(', ') || '—'} | ${r.missing} | ${esc(r.issues.join('; ')) || '—'} |`);
  if (researchNotes.length) {
    md.push('', '### 화면에 나가지 않는 원자료 원고 (연구 메모·전문가 검토용)', '', '| ID | 제목 | 유형 | 케이스 |', '|---|---|---|---|');
    for (const r of researchNotes) md.push(`| ${r.id} | ${esc(r.title)} | ${r.type} | ${r.cases.map((x) => CASE_LABEL[x] ?? x).join(', ')} |`);
  }
  md.push('', '## 2. 선택지별 연결 상태', '', '| 케이스 | 기간 | 선택지 ID | 분야 | 선택지 | 해결 목표 | 연결 원고 |', '|---|---|---|---|---|---|---|');
  for (const o of optionCoverage) md.push(`| ${CASE_LABEL[o.c]} | ${HZ_LABEL[o.h]} | ${o.id} | ${esc(o.group)} | ${esc(o.label)} | ${o.goals.join(', ') || '**없음**'} | ${o.ids.join(', ') || '**없음**'} |`);
  md.push('', '## 3. 해결 목표별 대안 경로 — 추가 조사 필요 목록', '', '경로 이름은 조사 후보이며 화면에 나가지 않습니다. "원자료 후보"는 Programs(미검증 대량 수집)에서 이름으로 찾은 건수입니다. 0건은 원자료에 없다는 뜻이지 제도가 없다는 뜻이 아닙니다.', '');
  md.push('| 목표 | 분야 | 연결 원고 | 대안 경로(조사 후보) | 원자료 후보 | 예시 |', '|---|---|---|---|---|---|');
  for (const g of GOALS) {
    const n = guides.filter((i) => i.goals.includes(g.id)).length;
    const pws = g.pathways?.length ? g.pathways : [{ name: '—', keywords: [] }];
    pws.forEach((pw, j) => md.push(`| ${j ? '' : `${g.id} ${esc(g.label)}`} | ${j ? '' : g.fields.map((f) => goalsFile.fields[f]).join(', ')} | ${j ? '' : n} | ${esc(pw.name)} | ${pw.rawHits === undefined ? (RAW ? '—' : '원자료 경로 없음') : `${pw.rawHits}건/${pw.rawNames}종`} | ${esc((pw.samples ?? []).slice(0, 2).join('; '))} |`));
  }
  md.push('', '## 경고 전체', '');
  const WT = { 1: '1. 선택지에 연결되지 않은 제도', 3: '3. 자격조건 누락', 4: '4. 공식 출처·확인일 누락', 6: '6. 단기·장기 분류 확인', 8: '8. 원자료에 있지만 질문 화면에서 찾을 수 없는 제도', gap: '선택지 공백(목표·원고 없음)', info: '참고' };
  for (const [k, t] of Object.entries(WT)) { md.push(`### ${t} (${warn[k].length})`, '', ...(warn[k].length ? warn[k].map((w) => `- ${esc(w)}`) : ['- 없음']), ''); }
  const out = join(ROOT, 'reports');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'link-audit.local.md'), md.join('\n') + '\n');
  writeFileSync(join(out, 'link-audit.local.json'), JSON.stringify({ date: today, summary: sum, rawStats, errors, warnings: warn, rows, options: optionCoverage, researchNotes, goals: GOALS }, null, 2) + '\n');
  console.log('보고서: reports/link-audit.local.md · reports/link-audit.local.json');
}

for (const s of sum) console.log(`  ${s}`);
if (errors.length) {
  console.error(`\n✖ 연결 검사 오류 ${errors.length}건 — 고친 뒤 다시 실행해 주세요.\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ 연결 검사 통과 (오류 0건)${REPORT || VERBOSE ? '' : ' — 자세한 목록: npm run audit:links'}`);
