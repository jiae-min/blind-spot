#!/usr/bin/env node
// 원자료(rawdata) → 사이트용 콘텐츠 JSON 내보내기
//
//   npm run export:content
//
// 읽는 곳: .env.local 의 RAWDATA_DIR (저장소 밖, 로컬 전용)
// 쓰는 곳:
//   src/data/content/published.json   공개 조건을 모두 통과한 원고만 → 저장소에 커밋
//   src/data/content/drafts.local.json 사용자용 원고 전체(검증 전 포함) → 커밋 안 함, 미리보기 빌드 전용
//
// 공개 조건 (3.3 §2, 4.3): 원자료의 publish_allowed === true, 운영자 승인, 승인 해시 = 현재 원고 해시.
// 이 조건을 스크립트가 완화하지 않는다. 검증 전 원고는 drafts.local.json 에만 들어간다.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/data/content');

// ── 설정 읽기 (.env.local → 환경 변수 순)
function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}
const env = { ...readEnvFile(join(ROOT, '.env.local')), ...process.env };
const RAW = env.RAWDATA_DIR;
if (!RAW || !existsSync(RAW)) {
  console.error('RAWDATA_DIR가 없거나 경로가 잘못됐어요. .env.local 에 원자료 폴더 경로를 적어 주세요 (.env.example 참고).');
  process.exit(1);
}

const load = (rel) => JSON.parse(readFileSync(join(RAW, rel), 'utf8'));
const stageMap = JSON.parse(readFileSync(join(ROOT, 'scripts/stage-map.json'), 'utf8'));
// 단계 카드 편집안 (저장소 밖, 선택). 승인된 편집안만 공개본에 들어감
const EDITORIAL = env.EDITORIAL_FILE && existsSync(env.EDITORIAL_FILE) ? JSON.parse(readFileSync(env.EDITORIAL_FILE, 'utf8')).items : {};
const stepOrder = JSON.parse(readFileSync(join(ROOT, 'scripts/step-order.json'), 'utf8')).order;

// ── 원자료
const status = load('04_ContentEditing/json/CurrentContentStatus.json'); // 현재 승인·QA 상태 (기준)
const drafts = load('04_ContentEditing/json/ContentDrafts.json');         // 케이스·단계·근거 연결
const evidence = [
  ...load('02_Agent02_사실검증/json/Evidence.json'),
  ...load('02_Agent02_사실검증/json/NewEvidence.json'),
];
const evidenceById = new Map(evidence.map((e) => [e.record_id, e]));
const draftById = new Map(drafts.map((d) => [d.record_id, d]));

// ── 규칙
const CASES = ['family-care', 'domestic-violence', 'sexual-violence', 'livelihood-education'];
const HORIZONS = ['short-term', 'long-term'];
const COST = ['무료 지원', '본인부담금 발생', '진료·검사·약제비 발생', '환급 가능 여부 확인 필요 · 조건부 지원', '비용 발생 여부 확인 필요'];
const KIND = { FAQ: 'faq', FAQ_DRAFT: 'faq', Guide: 'guide', MAIN_CONTENT_DRAFT: 'guide' };
// 사용자에게 보이지 않는 유형 (원자료 자체 표시)
const NOT_USER_CONTENT = new Set(['RESEARCH_NOTE_NOT_USER_CONTENT', 'EXPERT_REVIEW_DRAFT']);

const problems = [];
const items = [];
let skipped = 0;

for (const s of status) {
  if (NOT_USER_CONTENT.has(s.content_type)) { skipped++; continue; }
  const kind = KIND[s.content_type];
  const d = draftById.get(s.record_id) ?? {};
  if (!kind) { problems.push(`${s.record_id}: 모르는 content_type ${s.content_type}`); continue; }

  const cases = (d.case_ids ?? []).filter((c) => CASES.includes(c));
  const horizon = d.journey_stage || stageMap[s.record_id];
  if (!cases.length) problems.push(`${s.record_id}: case_ids 없음`);
  if (!HORIZONS.includes(horizon)) problems.push(`${s.record_id}: 단기/장기 구분 없음 → scripts/stage-map.json 에 추가`);
  if (!COST.includes(s.cost_status)) problems.push(`${s.record_id}: 표준 비용 문구가 아님 (${s.cost_status})`);

  const text = (s.body ?? s.answer ?? d.body ?? d.answer ?? '').trim();
  if (!text) problems.push(`${s.record_id}: 본문 없음`);

  const ev = (d.evidence_ids ?? s.evidence_ids ?? [])
    .map((id) => evidenceById.get(id))
    .filter(Boolean)
    .map((e) => ({
      title: e.source_title,
      url: e.resolved_url || e.source_url,
      checkedAt: (e.checked_at || e.last_checked_at || '').slice(0, 10) || null, // 날짜만 (YYYY-MM-DD)
    }))
    .filter((e) => e.url);
  // 같은 주소는 한 번만
  const seen = new Set();
  const evUnique = ev.filter((e) => (seen.has(e.url) ? false : seen.add(e.url)));
  const checkedAt = evUnique.map((e) => e.checkedAt).filter(Boolean).sort().at(-1) ?? null;

  const publishable =
    s.publish_allowed === true &&
    s.operator_decision === 'APPROVED' &&
    s.approved_hash && s.approved_hash === s.content_hash;

  items.push({
    id: s.record_id,
    kind,
    title: s.title,
    question: s.question || null,
    text,
    cases,
    horizon,
    costStatus: s.cost_status,
    costScope: s.cost_scope || null,
    risk: d.risk_level || null,
    version: s.content_version,
    checkedAt,
    evidence: evUnique,
    editorial: EDITORIAL[s.record_id] ?? null,
    order: stepOrder.includes(s.record_id) ? stepOrder.indexOf(s.record_id) : 999,
    draft: !publishable,
  });
}

if (problems.length) {
  console.error('내보내기를 멈췄어요. 원자료를 확인해 주세요:\n- ' + problems.join('\n- '));
  process.exit(1);
}

items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

// ── 같은 주어·목적어 단계 합치기 (편집안 merge / mergedInto)
// 합쳐진 원고는 대표 카드 안으로 들어가고, 대표 카드는 근거를 모두 가짐. 하나라도 검증 전이면 대표도 검증 전.
const byId = new Map(items.map((i) => [i.id, i]));
for (const host of items) {
  for (const id of host.editorial?.merge ?? []) {
    const m = byId.get(id);
    if (!m) { problems.push(`${host.id}: 합칠 원고 ${id} 없음`); continue; }
    m.mergedInto = host.id;
    host.mergedIds = [...(host.mergedIds ?? []), id];
    const urls = new Set(host.evidence.map((e) => e.url));
    for (const e of m.evidence) if (!urls.has(e.url)) { host.evidence.push(e); urls.add(e.url); }
    host.draft = host.draft || m.draft;
    host.checkedAt = [host.checkedAt, m.checkedAt].filter(Boolean).sort().at(-1) ?? null;
  }
}
if (problems.length) { console.error('합치기 오류:\n- ' + problems.join('\n- ')); process.exit(1); }

// 공개본: 편집안은 운영자 승인(approved=true)된 것만 남김. 편집안이 없으면 합치기도 적용하지 않음
const published = items
  .filter((i) => !i.draft)
  .map((i) => ({ ...i, editorial: i.editorial?.approved ? i.editorial : null }))
  .map((i) => (i.editorial ? i : { ...i, mergedInto: undefined, mergedIds: undefined }));

// ── 기관(센터) 목록: 해바라기센터 서울·경기 (원자료 보존본). 공개 조건은 원고와 같음
const SUNFLOWER = '91_이전패키지_원본보존/90_원자료보존/official_sources_20261105__sunflower/sunflower_data.json';
const resources = [];
if (existsSync(join(RAW, SUNFLOWER))) {
  for (const r of load(SUNFLOWER).Resources ?? []) {
    // 주소에서 시·도와 구·시·군을 읽음 (이름의 괄호 표기에는 오타가 있을 수 있어 주소를 기준으로)
    const m = (r.address ?? '').replace(/^\([^)]*\)/, '').trim().match(/^(서울|경기)\S*\s+(\S+?[시군구])(?=[\s,]|$)/); // \b는 한글에서 동작하지 않음
    if (!m) { console.warn(`  기관 주소를 읽지 못함: ${r.name}`); continue; }
    resources.push({
      id: r.id,
      kind: 'sunflower',
      name: r.name.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      cases: ['sexual-violence'],
      sido: m[1],
      sigungu: m[2],
      child: /아동/.test(r.name),
      phone: r.phone ?? null,
      address: r.address?.replace(/^\([^)]*\)/, '').trim() ?? null,
      homepage: r.homepage_urls?.[0] ?? null,
      sourceUrl: r.source_url,
      checkedAt: (r.collected_at ?? '').slice(0, 10) || '2026-11-05',
      draft: r.publish_allowed !== true,
    });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'published.json'), JSON.stringify(published, null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'drafts.local.json'), JSON.stringify(items, null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'resources.json'), JSON.stringify(resources.filter((r) => !r.draft), null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'resources.local.json'), JSON.stringify(resources, null, 2) + '\n');
console.log(`  기관: ${resources.length}곳 (공개 가능 ${resources.filter((r) => !r.draft).length}곳) → resources.json / resources.local.json`);

console.log(`원고 ${status.length}건 → 사용자용 ${items.length}건 (제외 ${skipped}건: 연구 메모·전문가 검토용)`);
console.log(`  편집안: ${Object.keys(EDITORIAL).length}건 (${env.EDITORIAL_FILE ? 'EDITORIAL_FILE' : '설정 없음'})`);
console.log(`  공개 가능: ${published.length}건 → src/data/content/published.json`);
console.log(`  미리보기 전용(검증 전 포함): ${items.length}건 → src/data/content/drafts.local.json (커밋 안 함)`);
