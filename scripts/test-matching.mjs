// 연결·필터링 규칙 시나리오 테스트 — npm test  (node --test, 추가 설치 없음)
// 실제 연결표(src/data/goals.json)와 실제 질문(case_questionnaires.json)을 쓰고, 원고만 가짜로 만든다(제도 내용 없음).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { goalIndex, linkedFor, eligibility, flagsFrom, personalize, compareRank, dedupe, optionKey } from '../src/data/matching.ts';

const goals = JSON.parse(readFileSync(new URL('../src/data/goals.json', import.meta.url), 'utf8')).goals;
const Q = JSON.parse(readFileSync(new URL('../src/data/v05/case_questionnaires.json', import.meta.url), 'utf8')).caseDefinitions;
const idx = goalIndex(goals);
const LE = 'livelihood-education', DV = 'domestic-violence', SV = 'sexual-violence', FC = 'family-care';
const card = (id, x = {}) => ({ id, kind: 'guide', horizon: 'long-term', cases: [LE], order: 0, goals: [], helpOptions: [], ...x });
const ids = (list) => list.map((i) => i.id);

test('S1 학위 취득: 제도명을 몰라도 같은 목표의 여러 경로가 함께 연결된다', () => {
  const items = [card('대학진학', { goals: ['degree'] }), card('독학학위제', { goals: ['degree'] }), card('학점은행제', { goals: ['degree'] }), card('국민취업지원', { goals: ['employment'] })];
  assert.deepEqual(ids(linkedFor(items, idx, LE, 'long-term', 'education.2')), ['대학진학', '독학학위제', '학점은행제']);
  // '중단한 학업을 이어가고 싶어요'도 학위 경로로 이어짐
  assert.ok(linkedFor(items, idx, LE, 'long-term', 'education.1').length === 3);
});

test('S2 다대다: 한 원고가 여러 케이스·선택지에, 한 선택지에 여러 원고가 연결된다', () => {
  const job = card('취업지원', { goals: ['employment'], cases: [LE, DV, SV, FC] });
  const items = [job, card('직업훈련', { goals: ['employment', 'vocational-cert'] })];
  for (const [c, o] of [[LE, 'work.1'], [DV, 'income_education.2'], [SV, 'work_school.2'], [FC, 'school_work.3']]) assert.ok(ids(linkedFor(items, idx, c, 'long-term', o)).includes('취업지원'), `${c} ${o}`);
  assert.deepEqual(ids(linkedFor(items, idx, LE, 'long-term', 'work.2')), ['취업지원', '직업훈련']);
  assert.deepEqual(ids(linkedFor(items, idx, LE, 'long-term', 'education.4')), ['직업훈련']);
});

test('S3 기존 helpOptions 직접 연결도 그대로 동작하고, 다른 기간·케이스·FAQ·합쳐진 카드는 선택지 아래에 안 나온다', () => {
  const items = [card('직접', { helpOptions: ['work.1'] }), card('단기', { horizon: 'short-term', goals: ['employment'] }), card('다른케이스', { cases: [DV], goals: ['employment'] }), card('faq', { kind: 'faq', goals: ['employment'] }), card('합침', { goals: ['employment'], mergedInto: '직접' })];
  assert.deepEqual(ids(linkedFor(items, idx, LE, 'long-term', 'work.1')), ['직접']);
});

test('S4 모든 지원 분야 선택지에 해결 목표가 하나 이상 있다 (none 제외)', () => {
  const keys = [];
  for (const [c, k] of Object.entries({ [DV]: 'domestic_violence', [SV]: 'sexual_violence', [FC]: 'family_care', [LE]: 'livelihood_education' })) {
    Q[k].short.help_groups.forEach((g) => g.options.forEach((_, i) => keys.push(optionKey(c, 'short-term', `${g.id}.${i + 1}`))));
    Q[k].long.questions.find((q) => q.groups).groups.forEach((g) => g.options.forEach((_, i) => keys.push(optionKey(c, 'long-term', `${g.id}.${i + 1}`))));
  }
  const missing = keys.filter((k) => !idx.has(k));
  assert.deepEqual(missing, []);
  const all = new Set(keys);
  assert.deepEqual(goals.flatMap((g) => g.options).filter((k) => !all.has(k)), [], '목표가 없는 선택지 ID를 가리킴');
});

const COND = { regions: ['서울특별시'], ageMin: 19, ageMax: 39, answers: { welfare: ['기초생활수급', '차상위'] } };

test('S5 지역·나이를 답하지 않으면 제외·불일치가 아니라 추가 확인 필요', () => {
  assert.equal(eligibility(COND, {}).status, 'check');
  assert.equal(eligibility(COND, { age: null, picks: {} }).status, 'check');
  assert.equal(eligibility(undefined, {}).status, 'check', '조건 정보가 없는 원고도 추가 확인 필요');
});

test('S6 모든 조건이 맞으면 기본 조건 부합, 확인된 답이 다를 때만 불일치', () => {
  const ok = { sido: '서울특별시', sidoSource: 'residence', age: 25, picks: { welfare: ['차상위'] } };
  assert.equal(eligibility(COND, ok).status, 'ok');
  assert.equal(eligibility(COND, { ...ok, age: 45 }).status, 'no');
  assert.equal(eligibility(COND, { ...ok, sido: '경기도' }).status, 'no');
  assert.equal(eligibility(COND, { ...ok, picks: { welfare: ['해당 없음'] } }).status, 'no');
});

test('S7 모름·답하지 않을래요·지역을 고르지 않을래요는 미응답으로 본다', () => {
  for (const l of ['모름', '답하지 않을래요.', '잘 모르겠어요.', '무응답']) assert.equal(eligibility({ answers: { welfare: ['기초생활수급'] } }, { picks: { welfare: [l] } }).status, 'check', l);
});

test('S8 단기 "지금 계신 곳"이 조건 지역과 달라도 불일치로 만들지 않는다', () => {
  assert.equal(eligibility({ regions: ['서울특별시'] }, { sido: '경기도', sidoSource: 'current' }).status, 'check');
  assert.equal(eligibility({ regions: ['서울특별시'] }, { sido: '서울특별시', sidoSource: 'current' }).status, 'ok');
});

test('S9 여러 조건 중 일부만 답해도, 답한 조건이 맞으면 불일치가 아니다 (복수 선택 질문 포함)', () => {
  const c = { ageMin: 19, answers: { relationship: ['현재 배우자·사실혼 관계', '전 배우자·과거 사실혼 관계'] } };
  assert.equal(eligibility(c, { age: 30, picks: {} }).status, 'check');
  assert.equal(eligibility(c, { age: 30, picks: { relationship: ['동거인', '전 배우자·과거 사실혼 관계'] } }).status, 'ok');
  assert.equal(eligibility(c, { picks: { relationship: ['잘 모르겠어요.'] } }).status, 'check');
});

test('S10 "신고할 생각이 없어요"는 제외하지 않고 순서·안내만 바꾼다', () => {
  const f = flagsFrom({ reporting: ['지금은 신고할 생각이 없어요.'] });
  assert.equal(f.noReport, true);
  const p = personalize({ needs: ['report'] }, f);
  assert.deepEqual(p.notes, ['report']);
  assert.ok(p.weight > 0);
  // 자격 판정에는 영향 없음
  assert.equal(eligibility({ ageMin: 19 }, { age: 30, picks: { reporting: ['지금은 신고할 생각이 없어요.'] } }).status, 'ok');
});

test('S11 "서류가 없어요"는 신청 불가가 아니라 안내 문장', () => {
  for (const l of ['지원 신청에 필요한 서류가 없어요.', '필요한 서류가 부족해요.', '서류 부족']) {
    const f = flagsFrom({ difficulties: [l] });
    assert.equal(f.noDocs, true, l);
    assert.deepEqual(personalize({ needs: ['documents'] }, f).notes, ['documents']);
  }
  assert.equal(eligibility({ regions: ['경기도'] }, { sido: '경기도', sidoSource: 'residence', picks: { difficulties: ['서류 부족'] } }).status, 'ok');
});

test('S12 연락·비용 어려움: 방문 필요 경로·유료 경로에 안내, 무료 경로는 앞으로', () => {
  const f = flagsFrom({ difficulties: ['연락·방문이 어려워요.', '비용이 부족해요.'] });
  assert.deepEqual(personalize({ needs: ['visit'], costValues: ['유료'] }, f).notes, ['visit', 'cost']);
  assert.ok(personalize({ costValues: ['무료'] }, f).weight < 0);
});

test('S13 정렬: 불일치는 맨 뒤, 신고 필요 경로는 미뤄도 불일치보다는 앞', () => {
  const list = [
    { id: 'no', status: 'no', weight: 0, order: 0 },
    { id: 'report', status: 'ok', weight: 3, order: 1 },
    { id: 'check', status: 'check', weight: 0, order: 2 },
    { id: 'ok', status: 'ok', weight: 0, order: 3 },
  ].sort(compareRank).map((x) => x.id);
  assert.deepEqual(list, ['ok', 'check', 'report', 'no']);
});

test('S14 여러 목표를 고르면 통합하되 같은 원고는 한 번만 전체 표시', () => {
  const r = dedupe([{ option: 'A', ids: ['x', 'y'] }, { option: 'B', ids: ['y', 'z'] }, { option: 'C', ids: ['x'] }]);
  assert.deepEqual(r.map((s) => s.show), [['x', 'y'], ['z'], []]);
  assert.deepEqual(r[1].dupOf, { y: 'A' });
  assert.deepEqual(r[2].dupOf, { x: 'A' });
});
