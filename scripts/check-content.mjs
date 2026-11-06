// content/*.json 검사 (D-032) — npm run build / build:preview 직전에 자동 실행 (package.json prebuild).
// 형식 오류 → 빌드 중단(실제 사이트는 직전 버전 유지). 확인 기한 지남·임박 → 경고만(화면에 '다시 확인 중' 표시).
// 사용: node scripts/check-content.mjs  (content/drafts/ 도 함께 검사하되, 승인 칸은 요구하지 않음)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../content/', import.meta.url));
const DRAFTS = join(ROOT, 'drafts');
const CASES = ['family-care', 'domestic-violence', 'sexual-violence', 'livelihood-education'];
const HORIZONS = ['short-term', 'long-term'];
const KINDS = ['guide', 'faq'];
const COSTS = ['유료', '무료', '조건부 지원', '확인 필요'];
const SOON_DAYS = 14;

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
    if (!draft) {
      need(str(it.approvedBy), '공개 파일인데 "approvedBy"(승인자)가 비었어요 — 승인 전이면 content/drafts/ 로 옮기세요');
      need(isDate(it.approvedAt), '공개 파일인데 "approvedAt"(승인일)이 없어요 — 승인 전이면 content/drafts/ 로 옮기세요');
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

for (const w of warns) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`\n✖ 콘텐츠 검사 실패 (${errors.length}건) — 고친 뒤 다시 올려 주세요. 실제 사이트는 직전 버전이 그대로 유지돼요.\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ 콘텐츠 검사 통과: 파일 ${files.length}개, 항목 ${ids.size}개${warns.length ? `, 경고 ${warns.length}건` : ''}`);
