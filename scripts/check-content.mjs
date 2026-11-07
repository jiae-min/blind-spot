// content/*.json 검사 (D-032) — npm run build / build:preview 직전에 자동 실행 (package.json prebuild).
// 형식 오류 → 빌드 중단(실제 사이트는 직전 버전 유지). 확인 기한 지남·임박 → 경고만(화면에 '다시 확인 중' 표시).
// 사용: node scripts/check-content.mjs  (content/drafts/ 도 함께 검사하되, 승인 칸은 요구하지 않음)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../content/', import.meta.url));
const DRAFTS = join(ROOT, 'drafts');
const CASES = ['family-care', 'domestic-violence', 'sexual-violence', 'livelihood-education', 'reclusive-youth'];
const HORIZONS = ['short-term', 'long-term'];
const KINDS = ['guide', 'faq'];
const COSTS = ['유료', '의료비 발생', '무료', '조건부 지원', '확인 필요'];
const SOON_DAYS = 14;

// 승인 해시 (v4 REQ-DATA-008, D-041): 승인한 원고와 공개 원고가 한 글자라도 다르면 빌드 중단.
// 항목에서 승인 칸(approvedBy·approvedAt·approvedHash)을 뺀 나머지를 키 순서대로 정렬해 SHA-256 → 앞 16자리.
// 해시 보기: npm run hash:content (각 항목의 현재 해시를 출력 — 내용을 확인·승인한 뒤 approvedHash에 붙여 넣음)
const APPROVAL_KEYS = ['approvedBy', 'approvedAt', 'approvedHash'];
const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
  : JSON.stringify(v);
const itemHash = (it) => createHash('sha256').update(canon(Object.fromEntries(Object.entries(it).filter(([k]) => !APPROVAL_KEYS.includes(k))))).digest('hex').slice(0, 16);
const HASH_MODE = process.argv.includes('--hash');
const NEEDS = ['report', 'documents', 'visit'];
const GOAL_IDS = new Set(JSON.parse(readFileSync(new URL('../src/data/goals.json', import.meta.url), 'utf8')).goals.map((g) => g.id));

// 질문 화면 선택지 ID (src/data/questionnaire.ts와 같은 규칙: 묶음ID.번호 / 질문ID.번호 / help.none)
// helpOptions에 없는 ID를 적으면 빌드를 멈춤 — 원본 질문 순서가 바뀌어 ID가 밀렸을 때 바로 알 수 있게
const Q = JSON.parse(readFileSync(new URL('../src/data/v05/case_questionnaires.json', import.meta.url), 'utf8')).caseDefinitions;
const QKEY = { 'domestic-violence': 'domestic_violence', 'sexual-violence': 'sexual_violence', 'family-care': 'family_care', 'livelihood-education': 'livelihood_education' };
const optionIds = (caseId, horizon) => {
  const d = Q[QKEY[caseId]];
  if (!d) return new Set();
  const out = new Set();
  const groups = horizon === 'short-term' ? (d.short.help_groups ?? []) : d.long.questions.find((q) => q.groups)?.groups ?? [];
  groups.forEach((g) => g.options.forEach((_, i) => out.add(`${g.id}.${i + 1}`)));
  if (horizon === 'short-term') (d.short.help_options ?? []).forEach((_, i) => out.add(`help.${i + 1}`));
  out.add(horizon === 'short-term' ? 'help.none' : 'goals.none');
  return out;
};
// 조건 칸 conditions.answers 에 쓸 수 있는 질문ID → 선택지 문구 (그 케이스·기간 질문에 실제로 있는 문구만)
const questionLabels = (caseId, horizon) => {
  const d = Q[QKEY[caseId]];
  const qs = !d ? [] : horizon === 'short-term' ? d.short.quick_questions : d.long.questions;
  return new Map(qs.filter((q) => Array.isArray(q.options) && q.options.length).map((q) => [q.id, new Set(q.options)]));
};

const today = new Date().toISOString().slice(0, 10);
const errors = [], warns = [];
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const strArr = (v) => Array.isArray(v) && v.every(str);

function checkFile(path, label, draft) {
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { errors.push(`${label}: JSON 형식이 깨졌어요 — ${e.message}`); return []; }
  if (!CASES.includes(data.case)) errors.push(`${label}: "case"는 ${CASES.join(' / ')} 중 하나여야 해요`);
  if (!Array.isArray(data.items)) { errors.push(`${label}: "items" 목록이 없어요`); return []; }
  data.items.forEach((it, n) => {
    const at = `${label} ${n + 1}번째 항목${it?.id ? ` (${it.id})` : ''}`;
    const need = (cond, msg) => { if (!cond) errors.push(`${at}: ${msg}`); };
    need(str(it.id), '"id"가 비었어요');
    need(KINDS.includes(it.kind), `"kind"는 ${KINDS.join(' / ')} 중 하나여야 해요`);
    need(HORIZONS.includes(it.horizon), `"horizon"은 ${HORIZONS.join(' / ')} 중 하나여야 해요`);
    need(Number.isFinite(it.order), '"order"(순서 숫자)가 없어요');
    need(str(it.title), '"title"이 비었어요');
    need(str(it.subtitle), '"subtitle"이 비었어요');
    need(strArr(it.points ?? []), '"points"는 문장 목록이어야 해요');
    need(strArr(it.notes ?? []), '"notes"는 문장 목록이어야 해요');
    need(it.cases === undefined || (Array.isArray(it.cases) && it.cases.every((c) => CASES.includes(c))), '"cases"에 없는 케이스가 있어요');
    // 질문 화면 연결 칸 (선택, D-039)
    if (it.helpOptions !== undefined) {
      need(strArr(it.helpOptions), '"helpOptions"는 선택지 ID 목록이어야 해요');
      const valid = new Set((it.cases ?? [data.case]).flatMap((c) => [...optionIds(c, it.horizon)]));
      (it.helpOptions ?? []).filter((o) => !valid.has(o)).forEach((o) => errors.push(`${at}: "helpOptions"의 "${o}"는 이 케이스·기간의 질문에 없는 선택지예요`));
    }
    if (it.conditions !== undefined) {
      const c = it.conditions;
      need(c && typeof c === 'object', '"conditions"는 { regions, ageMin, ageMax, answers } 형식이어야 해요');
      need(c?.regions === undefined || strArr(c.regions), '"conditions.regions"는 시·도 이름 목록이어야 해요 (예: "서울특별시")');
      need(c?.ageMin === undefined || Number.isInteger(c.ageMin), '"conditions.ageMin"은 정수여야 해요');
      need(c?.ageMax === undefined || Number.isInteger(c.ageMax), '"conditions.ageMax"는 정수여야 해요');
      if (c?.answers !== undefined) {
        need(c.answers && typeof c.answers === 'object' && !Array.isArray(c.answers), '"conditions.answers"는 { "질문ID": ["선택지 문구"] } 형식이어야 해요');
        const qmaps = (it.cases ?? [data.case]).map((cs) => questionLabels(cs, it.horizon));
        for (const [qid, labels] of Object.entries(c.answers ?? {})) {
          need(strArr(labels) && labels.length > 0, `"conditions.answers.${qid}"는 선택지 문구 목록이어야 해요`);
          const known = qmaps.map((m) => m.get(qid)).filter(Boolean);
          if (!known.length) { errors.push(`${at}: "conditions.answers"의 질문 "${qid}"는 이 케이스·기간 질문에 없어요`); continue; }
          (labels ?? []).filter((l) => !known.some((s) => s.has(l))).forEach((l) => errors.push(`${at}: "conditions.answers.${qid}"의 "${l}"는 질문 선택지 문구와 달라요 (띄어쓰기·마침표까지 같아야 해요)`));
        }
      }
    }
    if (it.goals !== undefined) {
      need(strArr(it.goals), '"goals"는 해결 목표 ID 목록이어야 해요');
      (it.goals ?? []).filter((g) => !GOAL_IDS.has(g)).forEach((g) => errors.push(`${at}: "goals"의 "${g}"는 src/data/goals.json 에 없는 목표예요`));
    }
    need(it.programName === undefined || str(it.programName), '"programName"(공식 제도명)이 비었어요 — 모르면 칸을 지워 두면 \'추가 확인 필요\'로 보여요');
    need(it.needs === undefined || (Array.isArray(it.needs) && it.needs.every((n) => NEEDS.includes(n))), `"needs"는 ${NEEDS.join(' / ')} 중에서만 적어 주세요`);
    for (const k of ['institution', 'eligibility', 'access', 'hours']) need(it[k] === undefined || str(it[k]), `"${k}"가 비었어요 — 모르면 칸을 지워 두면 '추가 확인 필요'로 보여요`);
    (it.costs ?? []).forEach((c, k) => {
      need(str(c?.item), `비용 ${k + 1}: "item"이 비었어요`);
      need(COSTS.includes(c?.value), `비용 ${k + 1}: "value"는 ${COSTS.join(' / ')} 중 하나여야 해요`);
    });
    need(Array.isArray(it.sources) && it.sources.length > 0, '공식 출처("sources")가 1개 이상 있어야 해요');
    (it.sources ?? []).forEach((s, k) => {
      need(str(s?.title), `출처 ${k + 1}: "title"이 비었어요`);
      need(typeof s?.url === 'string' && /^https:\/\//.test(s.url), `출처 ${k + 1}: "url"은 https:// 로 시작해야 해요`);
    });
    need(isDate(it.checkedAt), '"checkedAt"(확인일)이 YYYY-MM-DD 형식이 아니에요');
    need(isDate(it.nextCheck), '"nextCheck"(다음 확인일)이 YYYY-MM-DD 형식이 아니에요');
    if (isDate(it.checkedAt)) need(it.checkedAt <= today, '"checkedAt"이 오늘보다 뒤예요');
    if (isDate(it.checkedAt) && isDate(it.nextCheck)) need(it.nextCheck > it.checkedAt, '"nextCheck"는 "checkedAt"보다 뒤여야 해요');
    if (HASH_MODE) console.log(`${label}  ${it?.id ?? '(id 없음)'}  ${itemHash(it)}`);
    if (!draft) {
      need(str(it.approvedBy), '공개 파일인데 "approvedBy"(승인자)가 비었어요 — 승인 전이면 content/drafts/ 로 옮기세요');
      need(isDate(it.approvedAt), '공개 파일인데 "approvedAt"(승인일)이 없어요 — 승인 전이면 content/drafts/ 로 옮기세요');
      const h = itemHash(it);
      if (!str(it.approvedHash)) errors.push(`${at}: 공개 파일인데 "approvedHash"(승인 해시)가 없어요 — 내용을 확인했다면 "approvedHash": "${h}" 를 넣어 주세요`);
      else if (it.approvedHash !== h) errors.push(`${at}: 승인한 뒤 내용이 바뀌었어요 (승인 해시 ${it.approvedHash} ≠ 현재 ${h}). 바뀐 내용을 다시 확인·승인하고 approvedHash를 "${h}" 로 고쳐 주세요`);
    }
    if (isDate(it.nextCheck)) {
      const left = days(it.nextCheck, today);
      if (left < 0) warns.push(`${at}: 다음 확인일(${it.nextCheck})이 ${-left}일 지났어요 — 화면에 '다시 확인 중' 표시가 붙어요`);
      else if (left <= SOON_DAYS) warns.push(`${at}: 다음 확인일(${it.nextCheck})까지 ${left}일 남았어요`);
    }
  });
  return data.items.map((i) => i.id).filter(Boolean);
}

const ids = new Map();
const list = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []);
const files = [
  ...list(ROOT).map((f) => ({ path: join(ROOT, f), label: `content/${f}`, draft: false })),
  ...list(DRAFTS).map((f) => ({ path: join(DRAFTS, f), label: `content/drafts/${f}`, draft: true })),
];
for (const f of files) {
  for (const id of checkFile(f.path, f.label, f.draft)) {
    if (ids.has(id)) errors.push(`"${id}" 번호가 ${ids.get(id)}와 ${f.label}에 겹쳐요`);
    else ids.set(id, f.label);
  }
}

// 공식 확인한 해바라기센터 (content/centers/verified.json, D-039) — 여기 있는 센터만 공개 화면에 이름·번호가 나옴
const CENTER_FILE = join(ROOT, 'centers', 'verified.json');
if (existsSync(CENTER_FILE)) {
  const dir = JSON.parse(readFileSync(new URL('../src/data/v05/center_directory.json', import.meta.url), 'utf8')).centers.map((c) => c.id);
  try {
    const v = JSON.parse(readFileSync(CENTER_FILE, 'utf8'));
    if (!Array.isArray(v.centers)) errors.push('content/centers/verified.json: "centers" 목록이 없어요');
    (v.centers ?? []).forEach((c, n) => {
      const at = `content/centers/verified.json ${n + 1}번째${c?.id ? ` (${c.id})` : ''}`;
      if (!dir.includes(c?.id)) errors.push(`${at}: "id"는 ${dir.join(' / ')} 중 하나여야 해요`);
      if (!isDate(c?.checkedAt) || c.checkedAt > today) errors.push(`${at}: "checkedAt"(확인일)이 YYYY-MM-DD 형식이 아니거나 오늘보다 뒤예요`);
      if (!(typeof c?.sourceUrl === 'string' && /^https:\/\//.test(c.sourceUrl))) errors.push(`${at}: "sourceUrl"은 https:// 로 시작하는 공식 출처여야 해요`);
      if (!str(c?.approvedBy)) errors.push(`${at}: "approvedBy"(확인한 사람)가 비었어요`);
    });
  } catch (e) { errors.push(`content/centers/verified.json: JSON 형식이 깨졌어요 — ${e.message}`); }
}

for (const w of warns) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`\n✖ 콘텐츠 검사 실패 (${errors.length}건) — 고친 뒤 다시 올려 주세요. 실제 사이트는 직전 버전이 그대로 유지돼요.\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ 콘텐츠 검사 통과: 파일 ${files.length}개, 항목 ${ids.size}개${warns.length ? `, 경고 ${warns.length}건` : ''}`);
