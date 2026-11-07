// 케이스별 단기·장기 질문 (v0.5 후속 변경, 2026-11-07) — 원본: src/data/v05/case_questionnaires.json
// 원본 파일은 그대로 두고, 여기서 화면이 쓰는 형태로만 바꾼다. 문구는 원본 그대로 (status: proposal_requires_owner_review).
// 선택지 ID: 묶음 선택지는 '묶음ID.번호', 일반 질문은 '질문ID.번호' (1부터). 원고(content/*.json)의 helpOptions가 이 ID를 씀.
//  → 원본의 선택지 순서를 바꾸면 ID가 밀리므로, 순서를 바꿀 때는 원고의 helpOptions도 함께 고쳐야 함.
import raw from './v05/case_questionnaires.json';
import type { CaseId, Horizon } from './cases';

export type QType = 'single' | 'multi' | 'help' | 'region' | 'age';
export interface Opt { id: string; label: string; exclusive?: boolean }
export interface Group { id: string; label: string; options: Opt[] }
export interface Question {
  id: string;
  title: string;
  type: QType;
  options: Opt[];
  /** help 질문: 지원 분야별 아코디언 */
  groups?: Group[];
  /** 원본의 multi_always_expanded */
  alwaysOpen?: boolean;
  /** 이 지원 분야(묶음 ID) 중 하나를 골랐을 때만 보임 */
  conditionalOn?: string[];
  note?: string;
  /** help 질문: 묶음 없이 선택지를 바로 보여 줌 (가정폭력 단기 — 원본의 help_options) */
  flat?: boolean;
  /** help 질문의 '모르겠어요'를 골랐을 때 보여 줄 안내 문구 */
  noGoalNote?: string;
  /** 원본에 제목이 없는 질문(가정폭력 단기 '선택적 바로가기')은 화면용 제목을 붙이고 표시 */
  titleAdded?: boolean;
}
export interface Flow { caseKey: string; horizon: Horizon; questions: Question[] }

const KEY: Record<CaseId, string | undefined> = {
  'domestic-violence': 'domestic_violence',
  'sexual-violence': 'sexual_violence',
  'family-care': 'family_care',
  'livelihood-education': 'livelihood_education',
  'reclusive-youth': undefined, // 패키지에 없음 — 질문 없음
};

type RawQ = { id: string; title: string; type: string; options?: string[]; groups?: { id: string; label: string; options: string[] }[]; exclusiveOptions?: string[]; noGoalOption?: string; conditionalOn?: string[]; note?: string };
const defs = (raw as unknown as { caseDefinitions: Record<string, any>; no_goal_option: string }).caseDefinitions;
const NO_GOAL = (raw as any).no_goal_option as string;

const opts = (qid: string, list: string[] = [], exclusive: string[] = []): Opt[] =>
  list.map((label, i) => ({ id: `${qid}.${i + 1}`, label, ...(exclusive.includes(label) ? { exclusive: true } : {}) }));

const helpQ = (id: string, title: string, groups: RawQ['groups'] = [], noGoal = NO_GOAL): Question => ({
  id, title, type: 'help',
  groups: groups.map((g) => ({ id: g.id, label: g.label, options: opts(g.id, g.options) })),
  options: [{ id: `${id}.none`, label: noGoal, exclusive: true }],
});

function fromRaw(q: RawQ): Question {
  const base = { id: q.id, title: q.title, ...(q.conditionalOn ? { conditionalOn: q.conditionalOn } : {}), ...(q.note ? { note: q.note } : {}) };
  switch (q.type) {
    case 'multi_accordion': return helpQ(q.id, q.title, q.groups, q.noGoalOption);
    case 'region': case 'location_region_optional': return { ...base, type: 'region', options: [] };
    case 'integer_age': return { ...base, type: 'age', options: [] };
    case 'single': return { ...base, type: 'single', options: opts(q.id, q.options) };
    default: // multi, multi_always_expanded
      return { ...base, type: 'multi', options: opts(q.id, q.options, q.exclusiveOptions), alwaysOpen: q.type === 'multi_always_expanded' };
  }
}

/** 화면에 보여 줄 질문 순서 = 원본 순서 (단기: 긴급성 → 위치 → [바로가기] → 필요한 도움, 장기: questions 순서) */
export function flowFor(c: CaseId, h: Horizon): Flow | null {
  const key = KEY[c];
  const d = key ? defs[key] : undefined;
  if (!key || !d) return null;
  if (h === 'long-term') return { caseKey: key, horizon: h, questions: (d.long.questions as RawQ[]).map(fromRaw) };
  const s = d.short;
  const questions: Question[] = (s.quick_questions as RawQ[]).map(fromRaw);
  if (s.optional_shortcuts) {
    // 원본에 제목이 없음 → 화면용 제목 (운영자 검토 대상)
    questions.push({ id: 'shortcut', title: '지금 어떤 상황에 가까우신가요?', type: 'single', options: opts('shortcut', s.optional_shortcuts), titleAdded: true });
  }
  if (s.help_options) {
    // 묶음 없는 단일 목록 — ID는 'help.번호' (원고 helpOptions도 이 ID를 씀)
    const flat = helpQ('help', '어떤 도움을 받고 싶으신가요?', [{ id: 'help', label: '', options: s.help_options }], s.no_goal_option);
    questions.push({ ...flat, flat: true, ...(s.no_goal_note ? { noGoalNote: s.no_goal_note } : {}) });
  } else questions.push(helpQ('help', '어떤 도움을 받고 싶으신가요?', s.help_groups, s.no_goal_option));
  // 가족돌봄·생계교육 단기: 지역은 결과 안에서 필요할 때만 (optional_region_in_results)
  if (s.optional_region_in_results) questions.push({ id: 'region', title: '지역별 기관을 찾고 싶다면 지역을 골라 주세요', type: 'region', options: [], titleAdded: true });
  return { caseKey: key, horizon: h, questions };
}

/** 위험 응답 → 바로 연결할 긴급번호 (서비스 편집 제안: 즉시 안전·구조 경로 먼저) */
/** go: 고르는 즉시 이동할 페이지 (운영자 확정 2026-11-07: 가정폭력 단기 '지금 위험하거나 위협받고 있어요' → 긴급 도움) */
export const DANGER: Record<string, { tel: string; label: string; go?: string }> = {
  'risk.1': { tel: '112', label: '지금 위험하다면 112에 바로 연락하세요.', go: 'help/' },
  'urgent_status.1': { tel: '112', label: '지금 위험하다면 112에 바로 연락하세요.' },
  'urgent_care.1': { tel: '119', label: '응급상황이라면 119에 바로 연락하세요.' },
};

/** 추천 순서 조정에 쓰는 응답 표시: 문구로 찾아서 ID를 얻음 (원본 문구가 바뀌어도 '서류'·'신고할 생각이 없어요'가 들어 있으면 동작) */
export function flagsFor(flow: Flow) {
  const find = (qid: string, test: (l: string) => boolean) => flow.questions.find((q) => q.id === qid)?.options.find((o) => test(o.label))?.id;
  return {
    noReport: find('reporting', (l) => l.includes('신고할 생각이 없어요')),
    noDocs: find('difficulties', (l) => l.includes('서류')),
  };
}

/** 시·도 목록 (원본 장기 '지역' 질문의 선택지에서 '고르지 않을래요'를 뺀 것) */
export const SIDO: string[] = (defs.domestic_violence.long.questions as RawQ[]).find((q) => q.type === 'region')!.options!.filter((o) => !o.includes('고르지'));
