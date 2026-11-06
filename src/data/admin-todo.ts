// 검수 페이지(/admin/)의 '운영자 결정·확인 대기' 목록 (D-032). 끝나면 done: true 로 바꾸거나 지워 주세요.
export interface Todo { title: string; detail: string; ref: string; done?: boolean }

export const TODOS: Todo[] = [
  { title: '빠르게 나가기 이동처', detail: '지금은 임시로 naver.com. 최종 이동처를 정해 주세요.', ref: 'D-007' },
  { title: '긴급 연락처 출처 주소', detail: '1366 외 기관은 출처 이름만 있고 주소(URL)가 없어요. 주소를 주시면 데이터에 넣어요.', ref: 'D-024' },
  { title: '실제 휴대전화 검수', detail: '전화·문자 버튼이 열리는지, 아래 고정 막대가 보이는지, 긴급 도움을 연 뒤 비행기 모드에서도 열리는지. 실제 통화·문자 전송(특히 #0117)은 하지 않기.', ref: 'D-024·D-028' },
  { title: '단계 카드 편집안 판정', detail: 'content-editorial/편집안_검토표.md 8장 — ✅ / ✏️ / ❌.', ref: 'D-018' },
  { title: '미리보기 주소 잠금', detail: '미리보기 주소(초안·이 검수 페이지 포함)를 Cloudflare Access로 잠글지. 잠그지 않으면 주소를 아는 누구나 볼 수 있어요.', ref: 'D-016' },
  { title: '강조색 대비', detail: '주황 위 흰 작은 글자 3.2:1 (AA 4.5 미달). "유지"로 정했으나 출시 전 재확인.', ref: 'D-011' },
  { title: '문의 메일 보관 기간', detail: '개인정보 처리방침에 보관 기간을 적을지, 몇 개월로 할지.', ref: 'D-023' },
  { title: 'GitHub 업로드·Cloudflare 연결', detail: '첫 커밋 완료(작성자 jiae-min, 이 저장소에만 설정). 남은 일: github.com/new 에서 blind-spot 공개 저장소 만들기 → git push → Cloudflare Pages 연결.', ref: 'docs/GITHUB.md' },
];
