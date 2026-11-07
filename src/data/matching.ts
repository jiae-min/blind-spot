// 선택지 ↔ 원고 연결 · 공식 자격조건 판정(A) · 개인화 순서 조정(B) · 중복 노출 정리
// 화면(components/flow/Questionnaire.astro, 브라우저)과 검수 명령(scripts/check-links.mjs, Node)이 같은 규칙을 쓰도록 한곳에 둔다.
// 이 파일은 다른 파일을 import 하지 않는다 — Node가 타입만 지우고 바로 실행할 수 있게 (enum·namespace 등 지울 수 없는 문법 금지).
//
// 원칙 (v0.5 후속 recommendation_rules_delta.json filtering, DECISIONS D-039):
//  - 카드는 지우지 않는다. 상태와 순서만 바꾼다.
//  - 답하지 않았거나 '모르겠어요'면 정보 미상 → '추가 확인 필요'. 임의로 '불일치'로 만들지 않는다.
//  - 공식 조건(A)과 이용자가 원하는 행동(B: 신고 의사·서류·연락 방법·비용)을 섞지 않는다.
//    B는 '불일치'를 만들지 않고, 순서와 안내 문장만 바꾼다.

export type Horizon = 'short-term' | 'long-term';

// ── 1. 연결: 선택지 → 해결 목표 → 원고 (다대다)

export interface Goal { id: string; label: string; fields: string[]; options: string[]; pathways?: { name: string; keywords: string[] }[] }

/** 선택지 키: 케이스/기간/선택지ID (예: livelihood-education/long-term/education.2) */
export const optionKey = (c: string, h: Horizon, opt: string) => `${c}/${h}/${opt}`;

/** 선택지 키 → 연결된 목표 ID 목록 */
export function goalIndex(goals: Goal[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const g of goals) for (const k of g.options) idx.set(k, [...(idx.get(k) ?? []), g.id]);
  return idx;
}

export interface Linkable {
  id: string; kind: string; horizon: Horizon; cases: string[]; order: number;
  mergedInto?: string; helpOptions?: string[]; goals?: string[];
}

/** 이 원고가 이 선택지에 연결되는 이유: 직접 지정(helpOptions) / 목표 경유(goals) */
export function linkReason(item: Linkable, idx: Map<string, string[]>, c: string, h: Horizon, opt: string) {
  const direct = !!item.helpOptions?.includes(opt);
  const viaGoals = (idx.get(optionKey(c, h, opt)) ?? []).filter((g) => item.goals?.includes(g));
  return { direct, viaGoals, linked: direct || viaGoals.length > 0 };
}

/** 선택지 바로 아래에 보여 줄 단계 카드: 같은 케이스·같은 기간, 다른 카드에 합쳐지지 않은 것 */
export function linkedFor<T extends Linkable>(items: T[], idx: Map<string, string[]>, c: string, h: Horizon, opt: string): T[] {
  return items
    .filter((i) => i.kind === 'guide' && i.horizon === h && i.cases.includes(c) && !i.mergedInto && linkReason(i, idx, c, h, opt).linked)
    .map((i, n) => [i, n] as const)
    .sort((a, b) => a[0].order - b[0].order || a[1] - b[1])
    .map(([i]) => i);
}

// ── 2. A. 공식 자격조건 판정

export interface Conditions {
  /** 시·도 정식 이름 (예: 서울특별시) */
  regions?: string[];
  ageMin?: number;
  ageMax?: number;
  /** 질문ID → 조건에 맞는 선택지 문구 (예: { "welfare": ["기초생활수급", "차상위"] }). 소득·가구·돌봄 대상·가해자와의 관계 등 */
  answers?: Record<string, string[]>;
}

export interface Answers {
  sido?: string;
  /** residence = '생활하고 계신 지역'(장기), current = '지금 계신 곳'(단기). 지금 위치는 주소지 조건의 근거로 쓰지 않음 */
  sidoSource?: 'residence' | 'current';
  age?: number | null;
  /** 질문ID → 고른 선택지 문구 */
  picks?: Record<string, string[]>;
}

export type Status = 'ok' | 'check' | 'no';
export const STATUS_LABEL: Record<Status, string> = {
  ok: '기본 조건 부합 · 최종 선정은 별도 심사',
  check: '추가 확인 필요',
  no: '확인된 조건 불일치',
};

/** '모르겠어요'·'답하지 않을래요'·'무응답'·'지역을 고르지 않을래요' 등 → 답하지 않은 것으로 봄 */
const UNANSWERED = /모르|모름|답하지 않|무응답|고르지 않|선택하지 않/;
export const isUnanswered = (label: string) => UNANSWERED.test(label);

/** 조건 이름 (상태 이유 문장용). 없으면 질문ID 그대로 */
export const COND_NAMES: Record<string, string> = {
  region: '지역', age: '나이', welfare: '소득·복지 상황', household: '주거·가구 상황', relationship: '가해자와의 관계',
  living: '생활 상황', who: '돌보는 가족', recipient_age: '돌보는 가족의 연령대', need: '필요한 돌봄',
  current_services: '돌봄서비스 이용', activity: '현재 활동', existing_support: '이용 중인 지원', ongoing_safety: '안전 걱정',
};

export interface CondCheck { key: string; state: Status; why: 'unanswered' | 'current-location' | 'match' | 'mismatch' }

export const hasConditions = (c?: Conditions) =>
  !!c && (!!c.regions?.length || c.ageMin !== undefined || c.ageMax !== undefined || Object.keys(c.answers ?? {}).length > 0);

export function eligibility(cond: Conditions | undefined, a: Answers): { status: Status; checks: CondCheck[] } {
  const checks: CondCheck[] = [];
  if (!cond || !hasConditions(cond)) return { status: 'check', checks }; // 공식 조건이 원고에 없음 → 확인 필요
  if (cond.regions?.length) {
    if (!a.sido) checks.push({ key: 'region', state: 'check', why: 'unanswered' });
    else if (cond.regions.includes(a.sido)) checks.push({ key: 'region', state: 'ok', why: 'match' });
    else if (a.sidoSource === 'current') checks.push({ key: 'region', state: 'check', why: 'current-location' });
    else checks.push({ key: 'region', state: 'no', why: 'mismatch' });
  }
  if (cond.ageMin !== undefined || cond.ageMax !== undefined) {
    const n = a.age;
    if (n === null || n === undefined || !Number.isFinite(n)) checks.push({ key: 'age', state: 'check', why: 'unanswered' });
    else if ((cond.ageMin !== undefined && n < cond.ageMin) || (cond.ageMax !== undefined && n > cond.ageMax)) checks.push({ key: 'age', state: 'no', why: 'mismatch' });
    else checks.push({ key: 'age', state: 'ok', why: 'match' });
  }
  for (const [qid, allowed] of Object.entries(cond.answers ?? {})) {
    const picked = (a.picks?.[qid] ?? []).filter((l) => !isUnanswered(l));
    if (!picked.length) checks.push({ key: qid, state: 'check', why: 'unanswered' });
    else if (picked.some((l) => allowed.includes(l))) checks.push({ key: qid, state: 'ok', why: 'match' });
    else checks.push({ key: qid, state: 'no', why: 'mismatch' });
  }
  const status: Status = checks.some((c) => c.state === 'no') ? 'no' : checks.some((c) => c.state === 'check') ? 'check' : 'ok';
  return { status, checks };
}

// ── 3. B. 개인화: 순서와 실행 방법 안내만 조정 (제외·불일치 판정 없음)

export type Need = 'report' | 'documents' | 'visit';
export const NEEDS: Need[] = ['report', 'documents', 'visit'];

export interface Flags { noReport: boolean; noDocs: boolean; contactHard: boolean; costHard: boolean }

/** 응답 문구로 찾음 → 원본 문구가 조금 바뀌어도 '신고할 생각이 없어요'·'서류' 등이 들어 있으면 동작 */
export function flagsFrom(picks: Record<string, string[]> = {}): Flags {
  const diff = picks.difficulties ?? [];
  return {
    noReport: (picks.reporting ?? []).some((l) => l.includes('신고할 생각이 없어요')),
    noDocs: diff.some((l) => l.includes('서류')),
    contactHard: diff.some((l) => /연락|방문|전화/.test(l)),
    costHard: diff.some((l) => /비용|소득|현금|학비/.test(l)),
  };
}

export type Note = 'report' | 'documents' | 'visit' | 'cost';

/** costValues: content의 비용 칸 값(유료·의료비 발생·무료·조건부 지원·확인 필요) */
export function personalize(item: { needs?: string[]; costValues?: string[] }, f: Flags): { notes: Note[]; weight: number } {
  const needs = item.needs ?? [], costs = item.costValues ?? [];
  const notes: Note[] = [];
  let weight = 0;
  if (f.noReport && needs.includes('report')) { notes.push('report'); weight += 3; }
  if (f.noDocs && needs.includes('documents')) { notes.push('documents'); weight += 1; }
  if (f.contactHard && needs.includes('visit')) { notes.push('visit'); weight += 1; }
  if (f.costHard) {
    if (costs.some((v) => v === '유료' || v === '의료비 발생')) { notes.push('cost'); weight += 1; }
    else if (costs.length && costs.every((v) => v === '무료')) weight -= 1;
  }
  return { notes, weight };
}

/** 정렬: 확인된 불일치는 맨 뒤 → 개인화 가중치 → 기본 조건 부합 먼저 → 원래 순서 */
export function compareRank(x: { status: Status; weight: number; order: number }, y: { status: Status; weight: number; order: number }) {
  return (+(x.status === 'no') - +(y.status === 'no')) || (x.weight - y.weight) || (+(x.status !== 'ok') - +(y.status !== 'ok')) || (x.order - y.order);
}

// ── 4. 여러 선택지를 골랐을 때 같은 원고 중복 노출 정리: 처음 나온 곳에만 전체 카드, 나머지는 '위와 같음' 안내

export function dedupe(sections: { option: string; ids: string[] }[]) {
  const owner = new Map<string, string>();
  return sections.map(({ option, ids }) => {
    const show: string[] = [], dupOf: Record<string, string> = {};
    for (const id of ids) {
      const first = owner.get(id);
      if (first === undefined) { owner.set(id, option); show.push(id); }
      else dupOf[id] = first;
    }
    return { option, show, dupOf };
  });
}
