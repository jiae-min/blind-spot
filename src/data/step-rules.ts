// 성폭력 단기: 답에 따라 '지금 필요한 조치' 단계 순서를 바꾸는 규칙 (DECISIONS D-018)
// 합쳐진 카드는 대표 ID로 지정 (KR-01·KR-09 → D03-022, KR-04 → KR-03)
// 원칙: 단계를 숨기지 않고 순서만 바꿈. 첫 단계(1366)는 늘 맨 앞. 경과시간 규칙을 약물 규칙보다 먼저 적용.
// 시간 기준은 승인 원문에 적힌 숫자만 사용 (PEP 72시간 이내, 응급피임 늦어도 120시간 이내). 콘텐츠 검수 대상.
export const STEP_RULES = {
  pinFirst: 'D03-021',
  time: {
    // 1시간 이내 ~ 36~72시간
    early: { when: ['lt1h', '1-12h', '12-36h', '36-72h'], promote: ['CD-V1-KR-05', 'CD-V1-KR-03'], demote: [] as string[] },
    // 3~5일
    mid: { when: ['3-5d'], promote: ['CD-V1-KR-03'], demote: [] as string[] }, // 응급피임 카드(72시간 이후 내용 포함)
    // 5~7일 이후
    late: { when: ['5-7d', '1-2w', '2w-1m', '1-3m', '3-6m', '6m-1y', '1y+'], promote: [] as string[], demote: ['CD-V1-KR-05', 'CD-V1-KR-03'] },
  },
  drug: {
    when: ['known', 'suspected-memory-gap'],
    promote: ['D03-022'], // 해바라기센터 의료지원 카드(신고 전 의료지원·운영시간 포함)
  },
};
