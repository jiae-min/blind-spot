// 케이스 정의 — 인터페이스 레이블만 담는다. 실제 지원제도 원고(Raw Data)는 포함하지 않는다.
export type CaseId = 'family-care' | 'domestic-violence' | 'sexual-violence' | 'livelihood-education' | 'reclusive-youth';
export type Horizon = 'short-term' | 'long-term';

export interface CaseDef {
  id: CaseId;
  label: string;        // 짧은 케이스 이름
  prompt: string;       // 모바일 버튼 문구 (1.4 SCR-M-001)
  sensitive: boolean;   // 폭력 관련: 저장·추적 금지, 탭 제목 중립 (빠르게 나가기는 모든 케이스에 노출)
  ready: boolean;       // MVP 공개 대상. false면 고른 뒤 '현재 제작 중' 화면만 보여 줌 (D-022)
}

export const CASES: CaseDef[] = [
  { id: 'family-care', label: '가족돌봄', prompt: '가족을 돌보고 있어요', sensitive: false, ready: true },
  { id: 'domestic-violence', label: '가정폭력', prompt: '가정폭력으로 도움이 필요해요', sensitive: true, ready: true },
  { id: 'sexual-violence', label: '성폭력', prompt: '성폭력 피해로 도움이 필요해요', sensitive: true, ready: true },
  { id: 'livelihood-education', label: '생계·교육', prompt: '생활비와 교육비가 부담돼요', sensitive: false, ready: true },
  { id: 'reclusive-youth', label: '은둔 청년', prompt: '오랫동안 집 밖에 나가기 어려웠어요', sensitive: false, ready: false },
];

// 아직 공개하지 않은 케이스를 골랐을 때의 문구
export const COMING_SOON = { title: '현재 제작 중이에요!', lead: '빠르게 완성해서 도와드릴게요.' };

export const HORIZONS: { id: Horizon; title: string; sub: string }[] = [
  { id: 'short-term', title: '당장 필요한 도움', sub: '단기' },
  { id: 'long-term', title: '미래를 위한 도움', sub: '장기 지원' },
];

// base 경로(BASE_URL)를 붙인 내부 링크 — 배포 경로가 바뀌어도 그대로 동작
export const href = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

// 상세 페이지 메인 카피 (케이스 × 단기/장기) — 화면 문구, 제도 원고 아님. 제작 중(ready:false) 케이스는 비워 둬도 됨
export const COPY: Partial<Record<CaseId, Record<Horizon, { title: string; lead: string }>>> = {
  'family-care': {
    'short-term': { title: '돌봄이 버거운 지금, 함께 방법을 찾아볼게요.', lead: '갑작스러운 돌봄 부담을 덜 수 있도록, 지금 이용할 수 있는 도움부터 살펴보세요.' },
    'long-term': { title: '가족을 돌보면서도, 내 삶을 놓치지 않도록.', lead: '돌봄과 생계, 학업과 미래를 함께 준비할 수 있는 방법을 안내할게요.' },
  },
  'domestic-violence': {
    'short-term': { title: '무엇보다 지금, 안전이 먼저예요.', lead: '위험한 상황에서 도움을 요청하고 보호받을 수 있는 방법을 안내할게요.' },
    'long-term': { title: '이제는 나를 위한 일상을 준비할 수 있도록.', lead: '안전한 거처부터 경제적 독립, 법적 보호까지 필요한 방법을 찾아볼게요.' },
  },
  'sexual-violence': {
    'short-term': { title: '지금 가장 중요한 건, 안전과 건강이에요.', lead: '답해 주시면 지금 당장 필요한 걸 알려 드릴게요. 모르거나 답하기 어려우면 건너뛰어도 괜찮아요. 답한 내용은 저장하거나 어디에도 보내지 않아요.' },
    'long-term': { title: '일상을 다시 지켜갈 수 있도록.', lead: '치료와 회복, 법률지원과 생활 안정을 위한 선택지를 살펴볼게요.' },
  },
  'livelihood-education': {
    'short-term': { title: '당장의 부담부터, 덜어볼 방법을 찾아볼게요.', lead: '생활비와 교육비가 걱정될 때 이용할 수 있는 지원부터 살펴보세요.' },
    'long-term': { title: '앞으로의 선택지가 더 많아질 수 있도록.', lead: '배움과 일, 안정적인 생활을 준비하는 데 필요한 기회를 찾아볼게요.' },
  },
};

// 메인(PC) 줌인 화면의 단기/장기 버튼 안 요약 목록 — 받을 수 있는 도움의 '범주' 초안.
// 실제 제도명·금액·기관이 아님. 위 COPY 설명에서 뽑았고, 콘텐츠 검수 후 확정 (DECISIONS D-015).
export const HIGHLIGHTS: Partial<Record<CaseId, Record<Horizon, string[]>>> = {
  'family-care': {
    'short-term': ['일시·긴급 돌봄 서비스', '돌봄 비용 부담 덜기', '돌봄 상담·정보 창구', '돌보는 사람의 휴식 지원'],
    'long-term': ['생계 안정 지원', '학업·진로 이어가기', '일과 돌봄 함께하기', '마음 건강 돌보기'],
  },
  'domestic-violence': {
    'short-term': ['긴급 도움 요청', '안전한 곳으로 피하기', '상담 지원', '다친 곳 치료'],
    'long-term': ['안전한 거처 마련', '경제적 독립 준비', '법적 보호', '마음 회복'],
  },
  'sexual-violence': {
    'short-term': ['의료 지원', '보호 지원', '상담 지원'],
    'long-term': ['치료와 회복', '법률 지원', '생활 안정'],
  },
  'livelihood-education': {
    'short-term': ['생활비 부담 덜기', '교육비 부담 덜기', '긴급 지원 창구'],
    'long-term': ['배움 이어가기', '일자리 준비', '안정적인 생활 준비'],
  },
};
