# content/ — 사이트에 게시하는 안내 원고

이 폴더의 JSON 파일을 고치면, GitHub에 올리는 것(커밋)만으로 사이트가 자동으로 다시 만들어져요.
보통 1~2분 뒤 실제 주소에 반영돼요 (Cloudflare Pages가 자동 빌드).

- 페이지 코드(HTML·CSS)는 건드리지 않아요. 문구·기관·비용·출처는 모두 여기서만 고쳐요.
- 빌드할 때 `scripts/check-content.mjs`가 먼저 검사해요. 필수 칸이 빠졌거나 형식이 틀리면 **빌드가 멈추고**, 실제 사이트는 직전 버전이 그대로 유지돼요. 잘못된 파일이 그대로 공개되지 않아요.
- 다음 확인일(`nextCheck`)이 지난 항목은 화면에 "다시 확인 중이에요" 표시가 붙고, `/admin/` 검수 페이지에 빨갛게 나와요.

## 파일

| 파일 | 내용 | 공개 |
|---|---|---|
| `domestic-violence.json` | 가정폭력 단기·장기 안내 | ✅ (승인된 항목만) |
| `drafts/*.json` | 승인 전 원고. 같은 형식 | ❌ 저장소에 올라가지 않음. 로컬·미리보기·`/admin/`에서만 보임 |

**이 저장소는 공개예요.** 검증·승인 전 원고는 `domestic-violence.json`에 넣지 말고 `drafts/` 폴더에 두세요.
승인하면 항목을 `domestic-violence.json`으로 옮기고 `approvedBy`·`approvedAt`을 채워요.

## 항목 형식

```jsonc
{
  "case": "domestic-violence",
  "items": [
    {
      "id": "DV-S-001",            // 겹치지 않는 번호. S=단기, L=장기 (권장)
      "kind": "guide",             // guide = 단계 카드, faq = 궁금할 수 있는 질문
      "horizon": "short-term",     // short-term = 당장 필요한 도움, long-term = 미래를 위한 도움
      "order": 1,                  // 단계 순서 (작을수록 위)
      "title": "[행동형 제목 — faq면 질문]",
      "subtitle": "[받을 수 있는 도움 한 줄 — faq면 답 첫 문장]",
      "points": ["[도움 목록 — faq면 답의 나머지 문장]"],
      "notes": ["[알아 둘 점 — 없으면 빈 목록]"],
      "costs": [
        { "item": "[비용 항목]", "value": "무료" }   // 유료 / 무료 / 조건부 지원 / 확인 필요
      ],
      "sources": [
        { "title": "[출처 이름]", "url": "https://..." }   // 공식 출처, 1개 이상
      ],
      "checkedAt": "2026-11-06",   // 출처로 확인한 날
      "nextCheck": "2027-02-06",   // 다시 확인할 날 (지나면 '다시 확인 중' 표시)
      "approvedBy": "운영자",
      "approvedAt": "2026-11-06"
    }
  ]
}
```

- `[ ]` 안은 예시 자리예요. 실제 파일에는 주석(`//`)을 넣지 마세요 (JSON은 주석을 받지 않아요).
- 선택 칸: `notes`, `costs`(없으면 "비용 발생 여부 확인 필요"로 표시), `cases`(다른 케이스에도 같이 보여 줄 때 `["domestic-violence", "sexual-violence"]`).
- 날짜는 `YYYY-MM-DD`.

## GitHub 웹에서 고치는 법

1. GitHub 저장소 → `content/domestic-violence.json` → 연필(✏️ Edit) 아이콘
2. 고친 뒤 **Commit changes** → 메시지에 무엇을 고쳤는지 적기 (예: `가정폭력 단기: 1366 안내 확인일 갱신`)
3. 1~2분 뒤 사이트 확인. 반영이 안 되면 Cloudflare Pages → Deployments에서 빌드 기록의 빨간 오류 문구를 확인 (어느 항목·어느 칸이 틀렸는지 한국어로 나와요)
