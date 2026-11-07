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
승인하면 항목을 `domestic-violence.json`으로 옮기고 `approvedBy`·`approvedAt`·`approvedHash`를 채워요.

**승인 해시(`approvedHash`)** — 승인한 내용과 공개되는 내용이 같다는 표시예요. 승인 뒤 한 글자라도 바뀌면 빌드가 멈추고, 다시 확인한 뒤 새 해시를 넣어야 공개돼요.
해시는 `npm run hash:content`로 볼 수 있어요. 해시를 넣지 않고 올리면 검사 오류 문구에 넣을 값이 그대로 나와요.

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
        { "item": "[비용 항목]", "value": "무료" }   // 유료 / 의료비 발생 / 무료 / 조건부 지원 / 확인 필요
      ],
      "sources": [
        { "title": "[출처 이름]", "url": "https://..." }   // 공식 출처, 1개 이상
      ],
      "checkedAt": "2026-11-06",   // 출처로 확인한 날
      "nextCheck": "2027-02-06",   // 다시 확인할 날 (지나면 '다시 확인 중' 표시)
      "approvedBy": "운영자",
      "approvedAt": "2026-11-06",
      "approvedHash": "[npm run hash:content 로 본 16자리]"
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

## 질문 화면과 연결하기 (선택 칸, D-039)

단기·장기 페이지의 "어떤 도움을 받고 싶으신가요?"에서 사용자가 고른 항목 **바로 아래**에 원고를 보여 주려면 아래 칸을 채워요.
비워 두면 그 항목 아래에는 "확인된 제도 정보는 아직 게시 전이에요" 안내만 보여요.

| 칸 | 뜻 | 예 |
|---|---|---|
| `goals` | **권장.** 해결 목표 ID 목록(`src/data/goals.json`). 이 목표에 연결된 모든 선택지 아래에 보여요 — 제도명을 모르는 사람도 목표로 찾게. 원고는 한 번만 쓰고, 케이스가 여럿이면 `cases`에 함께 적어요 | `["degree"]` → 생계·교육 장기 "학위나 학력을 취득하고 싶어요", 가족돌봄 장기 "중단한 학업을 이어가고 싶어요" 등 |
| `helpOptions` | 이 원고를 보여 줄 선택지 ID를 직접 지정 (목표로 묶기 어려운 특별한 경우). 같은 원고를 여러 선택지에 걸어도 돼요 | `["immediate_safety.1", "basic_needs.2"]` |
| `programName` | 공식 제도명. 비우면 "추가 확인 필요" | `"국민취업지원제도"` |
| `conditions` | 공식 자격조건. 사용자의 답과 비교해 **기본 조건 부합(최종 선정은 별도 심사) / 추가 확인 필요 / 확인된 조건 불일치** 상태만 붙여요. 원고를 숨기지 않아요. 답하지 않았거나 '모르겠어요'면 추가 확인 필요 | `{ "regions": ["서울특별시"], "ageMin": 19, "ageMax": 64, "answers": { "welfare": ["기초생활수급", "차상위"] } }` |
| `needs` | 이 경로에 필요한 것: `report`(신고), `documents`(서류), `visit`(방문). "신고할 생각 없음"·"서류 없음"·"연락·방문이 어려움"을 고른 사람에게 순서를 뒤로 미루고 안내 문장을 붙여요. 지우지도, 불일치로 만들지도 않아요 | `["report"]` |
| `institution` · `eligibility` · `access` · `hours` | 기관명 · 신청 조건(문장) · 이용 방법 · 운영시간. 비우면 화면에 "추가 확인 필요" | `"hours": "365일 24시간"` |

**`conditions.answers`** — 질문ID와 선택지 문구를 `src/data/v05/case_questionnaires.json`에서 **그대로** 복사해요(띄어쓰기·마침표까지). 틀리면 빌드 전 검사가 멈춰요.
쓸 수 있는 예: `welfare`(소득·복지, 생계·교육 장기), `household`(주거·가구), `living`(가정폭력 생활 상황), `relationship`(가해자와의 관계), `who`(돌보는 가족), `recipient_age`(돌보는 가족의 연령대).
공식 자료에 적힌 조건만 적어요. 추측한 조건을 넣으면 맞는 사람이 '불일치'로 보일 수 있어요.

**연결 검사:** `npm run check:links`(빌드 전 자동) — 없는 목표·선택지 ID, 잘못된 판정이 있으면 멈춰요. 전체 표는 `npm run audit:links` → `reports/link-audit.local.md`(원자료 포함, 저장소에 안 올라감).

**선택지 ID 규칙:** `분야ID.번호`(1부터). 분야ID와 순서는 `src/data/v05/case_questionnaires.json`에 있어요. 단기는 `help_groups`, 장기는 첫 질문 `goals`의 `groups`.
"아직 어떤 도움이 필요한지 모르겠어요"는 단기 `help.none`, 장기 `goals.none`. 없는 ID를 적으면 빌드 전 검사가 멈춰서 알려 줘요.

예) 가정폭력 단기 '긴급 안전·보호' 첫 항목 "안전한 곳으로 이동하고 싶어요." → `immediate_safety.1`

## 해바라기센터 공식 확인 (`centers/verified.json`)

지역별 센터 연결표(`src/data/v05/center_region_mapping.json`)와 센터 기본 정보(`center_directory.json`)는 **게시 전 재검증 대상**이에요.
공식 출처로 주소·전화·운영시간을 확인한 센터만 아래처럼 적으면 공개 화면에 이름·번호가 나와요. 적지 않은 센터는 "1366에 연결 요청" 안내로 대신해요.

```json
{
  "centers": [
    { "id": "seoul-north", "checkedAt": "2026-11-10", "sourceUrl": "https://공식-안내-주소", "approvedBy": "운영자" }
  ]
}
```

`id`는 `seoul-central` `seoul-child` `seoul-north` `seoul-south` `seoul-east` `gyeonggi-central` `gyeonggi-northwest` `gyeonggi-south` `gyeonggi-child` `gyeonggi-west` `gyeonggi-northeast` 중 하나예요.
확인 중 주소·번호가 다르면 `center_directory.json`의 해당 값도 함께 고쳐 주세요.
