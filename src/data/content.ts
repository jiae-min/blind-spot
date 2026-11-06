// 사이트가 쓰는 콘텐츠 — scripts/export-content.mjs 가 만든 JSON만 읽는다.
//  - published.json: 공개 조건을 통과한 원고 (저장소에 커밋, 실제 공개 주소에서 사용)
//  - drafts.local.json: 검증 전 원고 포함 (커밋 안 함). 미리보기 빌드(--mode preview)에서만 섞어 보여 줌
import type { CaseId, Horizon } from './cases';
import published from './content/published.json';

export interface ContentItem {
  id: string;
  kind: 'faq' | 'guide';
  title: string;
  question: string | null;
  text: string;
  cases: CaseId[];
  horizon: Horizon;
  costStatus: string;
  costScope: string | null;
  risk: string | null;
  version: string;
  checkedAt: string | null;
  /** 다시 확인할 날 (content/*.json). 지나면 '다시 확인 중' 표시 (D-032) */
  nextCheck?: string | null;
  /** 원고가 들어 있는 파일 (검수 페이지 표시용) */
  file?: string;
  evidence: { title: string; url: string; checkedAt: string | null }[];
  order: number;
  draft: boolean;
  /** 다른 카드에 합쳐진 원고면 대표 카드 ID (목록에 따로 나오지 않음) */
  mergedInto?: string;
  mergedIds?: string[];
  /** 단계 카드 편집안 (행동형 제목·도움 목록). 공개본에는 승인된 것만 들어옴 */
  editorial: Editorial | null;
}

export interface Editorial {
  approved: boolean;
  action: string;
  subtitle: string;
  benefitsTitle?: string;
  benefits: string[];
  notes?: string[];
  costDetail?: string;
  /** 비용 항목별 줄. value: 유료 / 무료 / 조건부 지원 / 확인 필요 */
  costs?: { item: string; value: CostValue; detail?: string }[];
  merge?: string[];
  mergedInto?: string;
}

export type CostValue = '유료' | '무료' | '조건부 지원' | '확인 필요';
/** 쉬운 말(유료·무료…) ↔ 표준 비용 문구 5종(2.1 §6) */
export const COST_LABEL: Record<CostValue, string> = {
  유료: '본인부담금 발생',
  무료: '무료 지원',
  '조건부 지원': '환급 가능 여부 확인 필요 · 조건부 지원',
  '확인 필요': '비용 발생 여부 확인 필요',
};

/** 미리보기 모드: .env.preview 의 PUBLIC_SHOW_DRAFTS=1 (npm run build:preview / dev:preview) */
export const SHOW_DRAFTS = import.meta.env.PUBLIC_SHOW_DRAFTS === '1';

// 파일이 없어도(공개 빌드·깨끗한 클론) 오류 없이 빈 목록
const draftFiles = import.meta.glob<ContentItem[]>('./content/drafts.local.json', { eager: true, import: 'default' });
const draftItems: ContentItem[] = SHOW_DRAFTS ? (Object.values(draftFiles)[0] ?? []) : [];

// ── 운영자가 직접 고치는 원고: 저장소 맨 위 content/*.json (D-032)
//  - content/*.json: 승인된 항목만 (공개). content/drafts/*.json: 승인 전 (커밋 안 함, 미리보기에서만)
//  - 형식 검사는 scripts/check-content.mjs가 빌드 전에 함
export interface EditableItem {
  id: string; kind: 'guide' | 'faq'; horizon: Horizon; order: number;
  title: string; subtitle: string; points?: string[]; notes?: string[];
  costs?: { item: string; value: CostValue; detail?: string }[];
  sources: { title: string; url: string }[];
  checkedAt: string; nextCheck: string; cases?: CaseId[];
  approvedBy?: string; approvedAt?: string;
}
type EditableFile = { case: CaseId; items: EditableItem[] };
const fromEditable = (file: string, f: EditableFile, draft: boolean): ContentItem[] =>
  f.items.map((e) => {
    const costs = e.costs ?? [];
    return {
      id: e.id, kind: e.kind, title: e.title, question: e.kind === 'faq' ? e.title : null,
      text: [e.subtitle, ...(e.points ?? [])].join('\n'),
      cases: e.cases ?? [f.case], horizon: e.horizon,
      costStatus: costs.length ? COST_LABEL[costs[0].value] : '비용 발생 여부 확인 필요',
      costScope: null, risk: null, version: e.approvedAt ?? '', checkedAt: e.checkedAt, nextCheck: e.nextCheck, file,
      evidence: e.sources.map((s) => ({ title: s.title, url: s.url, checkedAt: e.checkedAt })),
      order: e.order, draft,
      // 단계 카드는 쓴 그대로 보여 줌(행동형 제목·도움 목록). FAQ는 답을 문장으로 나눠 보여 줌
      editorial: e.kind === 'guide' ? { approved: !draft, action: e.title, subtitle: e.subtitle, benefits: e.points ?? [], notes: e.notes ?? [], costs: costs.length ? costs : undefined } : null,
    };
  });
const editableFiles = import.meta.glob<EditableFile>('../../content/*.json', { eager: true, import: 'default' });
const editableDrafts = import.meta.glob<EditableFile>('../../content/drafts/*.json', { eager: true, import: 'default' });
const short = (p: string) => p.replace(/^.*\/content\//, 'content/');
const editableItems: ContentItem[] = [
  ...Object.entries(editableFiles).flatMap(([p, f]) => fromEditable(short(p), f, false)),
  ...(SHOW_DRAFTS ? Object.entries(editableDrafts).flatMap(([p, f]) => fromEditable(short(p), f, true)) : []),
];

const publishedItems = [...(published as ContentItem[]).map((i) => ({ ...i, file: 'src/data/content/published.json' })), ...editableItems.filter((i) => !i.draft)];
const publishedIds = new Set(publishedItems.map((i) => i.id));

export const CONTENT: ContentItem[] = [
  ...publishedItems,
  ...draftItems.filter((i) => i.draft && !publishedIds.has(i.id)).map((i) => ({ ...i, file: 'drafts.local.json (원자료 내보내기)' })),
  ...editableItems.filter((i) => i.draft && !publishedIds.has(i.id)),
];

/** 오늘 기준 확인 기한이 지났는지 (빌드 시각 기준) */
export const isStale = (i: Pick<ContentItem, 'nextCheck'>, today = new Date().toISOString().slice(0, 10)) => !!i.nextCheck && i.nextCheck < today;

export const contentFor = (c: CaseId, h: Horizon, kind: ContentItem['kind']) =>
  CONTENT.filter((i) => i.kind === kind && i.horizon === h && i.cases.includes(c) && !i.mergedInto)
    .map((i, n) => [i, n] as const).sort((a, b) => a[0].order - b[0].order || a[1] - b[1]).map(([i]) => i);

/** 본문을 문단으로 */
export const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

// ── 화면 표시용 변환 (승인 원문의 문장은 바꾸지 않고, 나누고 용어만 풀어 씀)

/** 어려운 용어: '풀어쓴 명칭(영문명칭, 한국어 전문명칭)' — 항목마다 처음 나올 때 한 번만 */
export const GLOSSARY: { term: string; full: string }[] = [
  { term: 'PEP', full: 'HIV 감염 예방약(PEP, 노출 후 예방요법)' },
  { term: 'HIV', full: '에이즈 바이러스(HIV, 인간면역결핍바이러스)' },
  { term: 'ARS', full: '자동 음성 안내(ARS, 자동응답시스템)' },
  { term: 'FAQ', full: '자주 묻는 질문(FAQ)' },
];

/** 한 덩어리 글 안에서 각 용어의 첫 등장만 풀어 씀. used 로 같은 항목 안 중복 방지 */
export function expandTerms(text: string, used = new Set<string>()) {
  let out = text;
  for (const { term, full } of GLOSSARY) {
    if (used.has(term)) continue;
    // 영문 약어가 단어 경계에 있을 때만 (예: 'STOP' 안의 다른 글자와 섞이지 않게)
    const re = new RegExp(`(?<![A-Za-z])${term}(?![A-Za-z])`);
    if (re.test(out)) {
      out = out.replace(re, full);
      used.add(term);
      // 풀어 쓴 말 안에 들어 있는 다른 약어(예: PEP 풀이 속 HIV)는 다시 풀지 않음
      for (const g of GLOSSARY) if (g.term !== term && full.includes(g.term)) used.add(g.term);
    }
  }
  return out;
}

/** 문장 단위로 나누기 (마침표·물음표·느낌표 뒤 공백, 줄바꿈) */
export const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/**
 * 카드·FAQ 표시 형태:
 *  statement — 첫 문장(바로 답하는 확언). '네.'·'아니요.'만 있는 첫 문장은 다음 문장과 합침
 *  points    — 나머지 문장을 짧은 목록으로
 */
export function present(item: ContentItem) {
  const used = new Set<string>();
  const title = expandTerms(item.title, used);
  const all = sentences(item.text);
  let first = all.shift() ?? '';
  if (/^(네|예|아니요|아니오)[.,]?$/.test(first) && all.length) first = `${first} ${all.shift()}`;
  const bodyUsed = new Set<string>(); // 제목에서 풀어 썼어도 본문 첫 등장은 다시 풀어 씀
  const statement = expandTerms(first, bodyUsed);
  const points = all.map((s) => expandTerms(s, bodyUsed));
  return { title, statement, points };
}

/**
 * 단계 카드 표시 형태. 편집안이 있으면 행동형 제목 + 받을 수 있는 도움 목록,
 * 없으면 원문을 나눈 형태(present)로 대신함.
 */
export function presentGuide(item: ContentItem) {
  const e = item.editorial;
  if (!e) {
    const p = present(item);
    return { title: p.title, subtitle: p.statement, listTitle: null, list: p.points, notes: [] as string[], costDetail: item.costScope ? `${item.costScope}은(는) 기관에 확인해 주세요.` : null };
  }
  const used = new Set<string>();
  return {
    title: expandTerms(e.action, used),
    subtitle: expandTerms(e.subtitle, used),
    listTitle: e.benefitsTitle ?? '이렇게 도움받을 수 있어요',
    list: e.benefits.map((b) => expandTerms(b, used)),
    notes: (e.notes ?? []).map((n) => expandTerms(n, used)),
    costDetail: e.costDetail ?? null,
  };
}

// ── 기관(센터) 목록 — resources.json(공개) + resources.local.json(미리보기 초안)
import publishedResources from './content/resources.json';
export interface ResourceItem {
  id: string; kind: string; name: string; cases: CaseId[];
  sido: '서울' | '경기'; sigungu: string; child: boolean;
  phone: string | null; address: string | null; homepage: string | null;
  sourceUrl: string; checkedAt: string; draft: boolean;
}
const resourceDrafts = import.meta.glob<ResourceItem[]>('./content/resources.local.json', { eager: true, import: 'default' });
const pubRes = publishedResources as ResourceItem[];
export const RESOURCES: ResourceItem[] = [
  ...pubRes,
  ...(SHOW_DRAFTS ? (Object.values(resourceDrafts)[0] ?? []).filter((r) => r.draft && !pubRes.some((p) => p.id === r.id)) : []),
];
export const resourcesFor = (c: CaseId) => RESOURCES.filter((r) => r.cases.includes(c));
