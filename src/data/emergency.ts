// 긴급 도움 연락처 (SCR-E-001) — 운영자 제공 확정 목록, 2026-11-06 확인 기준 (D-024).
// 원칙: 확인되지 않은 시간·조건을 채우지 않는다. '지금 연결 가능' 같은 실시간 표시를 하지 않는다.
// 같은 기관은 ORGS 하나를 참조하고, 서비스마다 시간이 다르면(129) SERVICES를 따로 둔다.

export const CHECKED = '2026-11-06';

/** 검증 상태: verified = 운영자가 출처로 확인 / needs-check = 일부 사항 확인 필요 */
export type Status = 'verified' | 'needs-check';

export interface Org {
  id: string;
  name: string;
  number: string;        // 화면 표시
  tel?: string;          // 전화 링크 수신번호 (없으면 전화 버튼 대신 별도 처리 — 1388)
  region?: '서울' | '경기';
  source: { name: string; url?: string }; // url: 운영자가 준 것만 (미제공은 비움)
  wellKnown?: boolean;   // 112·119·1366: 널리 알려진 번호라 카드에 출처 줄을 표시하지 않음 (데이터에는 유지)
  checked: string;
  status: Status;
}

export const ORGS: Record<string, Org> = {
  '112': { id: '112', name: '경찰', number: '112', tel: '112', source: { name: '경찰 신고 안내' }, wellKnown: true, checked: CHECKED, status: 'verified' },
  '119': { id: '119', name: '소방·구급', number: '119', tel: '119', source: { name: '소방 신고 안내' }, wellKnown: true, checked: CHECKED, status: 'verified' },
  '1366': { id: '1366', name: '여성긴급전화', number: '1366', tel: '1366', source: { name: '1366 운영 안내', url: 'https://www.women1366.kr/' }, wellKnown: true, checked: CHECKED, status: 'verified' },
  d4u: { id: 'd4u', name: '중앙디지털성범죄피해자지원센터', number: '02-735-8994', tel: '027358994', source: { name: '중앙디지털성범죄피해자지원센터 안내' }, checked: CHECKED, status: 'verified' },
  seoulDigital: { id: 'seoulDigital', name: '서울디지털성범죄안심지원센터', number: '02-815-0382', tel: '028150382', region: '서울', source: { name: '서울디지털성범죄안심지원센터 안내' }, checked: CHECKED, status: 'verified' },
  ggDigital: { id: 'ggDigital', name: '경기도디지털성범죄피해자원스톱지원센터', number: '1544-9112', tel: '15449112', region: '경기', source: { name: '경기도디지털성범죄피해자원스톱지원센터 안내' }, checked: CHECKED, status: 'verified' },
  '1388': { id: '1388', name: '청소년상담', number: '1388', source: { name: '1388 이용 안내' }, checked: CHECKED, status: 'verified' },
  '117': { id: '117', name: '학교폭력 신고센터', number: '117', tel: '117', source: { name: '117 신고센터 안내' }, checked: CHECKED, status: 'verified' },
  disability: { id: 'disability', name: '장애인권익옹호기관', number: '1644-8295', tel: '16448295', source: { name: '장애인권익옹호기관 안내' }, checked: CHECKED, status: 'needs-check' },
  elder: { id: 'elder', name: '노인보호전문기관', number: '1577-1389', tel: '15771389', source: { name: '노인학대 긴급전화 운영기준' }, checked: CHECKED, status: 'verified' },
  '129': { id: '129', name: '보건복지상담센터', number: '129', tel: '129', source: { name: '129 상담시간 안내' }, checked: CHECKED, status: 'verified' },
  danuri: { id: 'danuri', name: '다누리콜센터', number: '1577-1366', tel: '15771366', source: { name: '다누리콜센터 안내' }, checked: CHECKED, status: 'verified' },
  '1345': { id: '1345', name: '외국인종합안내센터', number: '1345', tel: '1345', source: { name: '1345 이용 안내' }, checked: CHECKED, status: 'verified' },
  '132': { id: '132', name: '대한법률구조공단', number: '132', tel: '132', source: { name: '132 직접 운영 안내' }, checked: CHECKED, status: 'verified' },
  '1350': { id: '1350', name: '고용노동부 고객상담센터', number: '1350', tel: '1350', source: { name: '1350 직접 운영 안내' }, checked: CHECKED, status: 'verified' },
};

/** 채널별 시간. kind: receipt = 상시 접수(신고), counsel = 상담 */
export interface Hours { channel: 'phone' | 'sms' | 'chat' | 'board'; kind: 'receipt' | 'counsel'; label: string; text: string; parts: string[]; allDay: boolean }
// parts: 시간대를 한 줄씩 (평일·주말처럼 쉼표로 잇지 않고 목록으로 보여 줌, D-029)

export interface Service {
  title: string;     // 상황 제목
  org: string;       // ORGS 키
  hours: Hours[];
  notes?: string[];  // 반드시 함께 표시할 조건
  areaCode?: boolean; // 휴대전화는 지역번호 + 번호 (1388)
  region?: '서울' | '경기'; // 제목 앞 지역 상자
}

const phone = (t: string | string[], kind: Hours['kind'] = 'counsel'): Hours => {
  const parts = Array.isArray(t) ? t : [t];
  const text = parts.join(', ');
  return { channel: 'phone', kind, label: kind === 'receipt' ? '신고 접수' : '전화상담 시간', text, parts, allDay: /24시간/.test(text) };
};

/** 상단 고정 (접지 않음) */
export const TOP: Service[] = [
  { title: '지금 폭력·위협을 받고 있어요', org: '112', hours: [phone('365일 24시간 신고 접수', 'receipt')] },
  { title: '응급환자·구조가 필요해요', org: '119', hours: [phone('365일 24시간 신고 접수', 'receipt')] },
  { title: '폭력 피해 상담·보호가 필요해요', org: '1366', hours: [phone('365일 24시간 전화상담')] },
];

export const CATEGORIES: { id: string; name: string; items: Service[] }[] = [
  {
    id: 'violence', name: '가정폭력·교제폭력·스토킹', items: [
      { title: '폭력 피해 상담과 보호 연결이 필요해요', org: '1366', hours: [phone('365일 24시간')] },
    ],
  },
  {
    id: 'sexual', name: '성폭력·디지털성범죄', items: [
      { title: '성폭력 피해로 어디에 도움을 요청할지 모르겠어요', org: '1366', hours: [phone('365일 24시간')] },
      { title: '불법촬영·유포·딥페이크 피해가 있어요', org: 'd4u', hours: [phone(['평일 08:00~22:00', '주말·공휴일 09:00~18:00'])], notes: ['상담시간 외에는 여성긴급전화 1366으로 연락해 주세요.'] },
      { title: '디지털성범죄 지원기관에 연락하고 싶어요', region: '서울', org: 'seoulDigital', hours: [phone(['평일 09:00~18:00', '점심 12:00~13:00 제외'])] },
      { title: '디지털성범죄 지원기관에 연락하고 싶어요', region: '경기', org: 'ggDigital', hours: [phone(['평일 09:00~18:00', '점심 12:00~13:00 제외'])] },
    ],
  },
  {
    id: 'youth', name: '아동·청소년', items: [
      { title: '집·학교 문제로 도움이 필요해요', org: '1388', areaCode: true, hours: [phone('365일 24시간')], notes: ['9~24세 청소년과 부모·보호자가 이용할 수 있어요.', '유선전화는 1388, 휴대전화는 지역번호 + 1388로 걸어요.'] },
      { title: '학교폭력을 신고하거나 상담하고 싶어요', org: '117', hours: [phone('365일 24시간')] },
    ],
  },
  {
    id: 'abuse', name: '장애인·노인 학대', items: [
      { title: '장애인 학대가 의심돼요', org: 'disability', hours: [phone('연결되는 지역기관에 확인 필요')], notes: ['지역기관으로 연결돼요. 상담시간은 기관마다 달라 확인이 필요해요.', '지금 위험하다면 112로 연락해 주세요.'] },
      { title: '어르신이 학대·방임을 겪고 있어요', org: 'elder', hours: [phone('연중 24시간 긴급전화 운영')] },
    ],
  },
  {
    id: 'welfare', name: '생계·돌봄·복지', items: [
      { title: '당장 생활비·생계가 막막해요', org: '129', hours: [phone('긴급복지지원·복지사각지대 상담 24시간')] },
      { title: '돌봄·복지제도를 알아보고 싶어요', org: '129', hours: [phone('일반 상담 평일 09:00~18:00')] },
    ],
  },
  {
    id: 'migrant', name: '이주민·다국어 지원', items: [
      { title: '다른 언어로 폭력 피해·생활 상담이 필요해요', org: 'danuri', hours: [phone('365일 24시간')], notes: ['한국어를 포함해 15개 언어로 상담해요.'] },
      { title: '체류·출입국 문제를 상담하고 싶어요', org: '1345', hours: [phone('평일 09:00~22:00')], notes: ['18시 이후에는 한국어·영어·중국어로 안내해요.'] },
    ],
  },
  {
    id: 'legal', name: '법률·노동', items: [
      { title: '법적 대응 방법을 알고 싶어요', org: '132', hours: [phone(['평일 09:00~11:50', '평일 13:00~17:50'])], notes: ['통화료가 발생해요.'] },
      { title: '임금·해고·고용 문제로 도움이 필요해요', org: '1350', hours: [phone('평일 09:00~18:00')], notes: ['통화료가 발생해요.'] },
    ],
  },
];

/** 전화가 어려울 때 — 문자는 작성 화면만 열고 자동 전송하지 않음 */
export interface Alt { label: string; kind: 'sms' | 'link'; to: string; shown: string; note: string; org: string }
export const ALTERNATIVES: Alt[] = [
  { label: '112로 문자 신고하기', kind: 'sms', to: '112', shown: '문자 112', note: '24시간 신고 접수', org: '112' },
  { label: '119로 문자 신고하기', kind: 'sms', to: '119', shown: '문자 119', note: '24시간 신고 접수', org: '119' },
  { label: '1366 채팅·카카오톡 상담 안내', kind: 'link', to: 'https://www.women1366.kr/', shown: 'women1366.kr', note: '온라인 상담은 전화상담과 응답 시간이 다를 수 있어요. 사이트에서 이용 방법을 확인해 주세요.', org: '1366' },
  { label: '1388로 문자 상담하기', kind: 'sms', to: '1388', shown: '문자 1388', note: '365일 24시간 상담', org: '1388' },
  { label: '117로 문자 신고하기', kind: 'sms', to: '#0117', shown: '문자 #0117', note: '365일 24시간 신고·상담', org: '117' },
  { label: '장애인학대 문자 신고 안내', kind: 'sms', to: '1644-8295', shown: '문자 1644-8295', note: '지역기관 상담시간에 차례로 답해요. 야간·주말에는 바로 답하지 못할 수 있어요.', org: 'disability' },
];
export const ALT_NOTE = '문자에는 현재 위치와 필요한 도움을 적어 주세요. 상담 답변을 기다리는 동안 즉각적인 위험이 생기면 112, 응급환자·구조 상황이면 119로 연락해 주세요.';

/** 1388 휴대전화용 지역번호 */
export const AREA_CODES: [string, string][] = [
  ['02', '서울'], ['031', '경기'], ['032', '인천'], ['033', '강원'], ['041', '충남'], ['042', '대전'], ['043', '충북'], ['044', '세종'],
  ['051', '부산'], ['052', '울산'], ['053', '대구'], ['054', '경북'], ['055', '경남'], ['061', '전남'], ['062', '광주'], ['063', '전북'], ['064', '제주'],
];

export const telHref = (n: string) => `tel:${n.replace(/[^0-9]/g, '')}`;
// '#'은 주소에서 특수 문자라 %23으로 (117 문자 수신번호 #0117)
export const smsHref = (n: string) => `sms:${n.replace(/[^0-9#]/g, '').replace('#', '%23')}`;

/** 카드 번호 옆 한 줄 표시: 24시간이면 '24시간 전화(, 문자) 가능', 아니면 전화 가능 시간 문장 (표 대신, D-025) */
export function quickHours(s: Service): { allDay: boolean; text: string; parts: string[] } {
  const phone = s.hours.filter((h) => h.channel === 'phone');
  const phone24 = phone.length > 0 && phone.every((h) => h.allDay);
  const sms24 = ALTERNATIVES.some((a) => a.org === s.org && a.kind === 'sms' && /24시간/.test(a.note));
  if (phone24) return { allDay: true, text: sms24 ? '24시간 전화, 문자 가능' : '24시간 전화 가능', parts: [] };
  return { allDay: false, text: '전화 가능 시간', parts: phone.flatMap((h) => h.parts) };
}
