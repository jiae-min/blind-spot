# blind spot

가족돌봄 · 가정폭력 · 성폭력 · 생계·교육 · 은둔 청년 등 **사회적·경제적 제약으로 정보 접근에 어려움을 겪는 약자들**이 자신의 상황을 바탕으로 실질적인 해결책을 발견하도록 돕습니다.

> 현재 공개 빌드는 **화면 시안**입니다. 지원제도 안내는 전문가 검토와 QA를 통과한 원고만 게시합니다.

## 기술

- [Astro](https://astro.build) 정적 사이트 (서버·데이터베이스 없음)
- 배포: Cloudflare Pages (GitHub 연동)
- 글꼴: 기기 기본 글꼴(내려받는 글꼴 없음). 로고만 Kanit 모양을 SVG로 넣음 — 페이지당 첫 방문 약 15~18KB

## 폴더 구조

```
├─ content/                  ★ 운영자가 직접 고치는 안내 원고 (JSON). 고쳐서 올리면 자동 반영 — content/README.md
├─ docs/DECISIONS.md          설계 결정 기록 (기획서 이후 변경 사항)
├─ docs/GITHUB.md             GitHub 첫 업로드·Cloudflare 연결·데이터 수정 방법
├─ public/                    정적 파일 (_headers: 보안 헤더, licenses/: 글꼴 고지)
├─ scripts/
│  ├─ check-content.mjs       content/ 형식·확인 기한 검사 (빌드 직전 자동 실행, 틀리면 빌드 중단)
│  ├─ export-content.mjs      원자료 → 사이트 콘텐츠 JSON 변환 + 공개 조건 검사
│  └─ stage-map.json          단기/장기 분류표 (원자료에 구분이 없는 원고)
└─ src/
   ├─ assets/                 집 단면도 SVG
   ├─ components/             화면 부품 (templates/: 상세 페이지 틀, wf/: 카드·FAQ·선택지 등)
   ├─ data/
   │  ├─ cases.ts             케이스·단기/장기·카피
   │  ├─ content.ts           콘텐츠 읽기 (공개본 / 미리보기 초안)
   │  └─ content/published.json  공개 조건을 통과한 원고 (export 결과)
   ├─ layouts/  pages/  styles/
```

## 개발

Node 22.23 이상.

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # 공개용 빌드 → dist/
```

## 콘텐츠 반영

### 가장 쉬운 방법: content/ 파일 고치기

`content/domestic-violence.json`을 고쳐 커밋하면 Cloudflare가 자동으로 다시 빌드해요(1~2분). 형식은 [content/README.md](content/README.md).
승인 전 원고는 `content/drafts/`(커밋 안 됨)에 두면 미리보기와 `/admin/`에서만 보여요.

### 원자료 패키지에서 내보내기

원자료(조사·검수 패키지)는 용량과 비공개 자료 때문에 **이 저장소에 넣지 않습니다.**

1. `.env.example`을 `.env.local`로 복사하고 `RAWDATA_DIR`(원자료 폴더)와, 있으면 `EDITORIAL_FILE`(단계 카드 편집안 JSON) 경로를 적습니다. 편집안은 `approved: true`인 것만 공개본에 들어갑니다.
2. `npm run export:content`
   - 공개 조건(원자료의 `publish_allowed`, 운영자 승인, 승인 해시 일치)을 모두 통과한 원고 → `src/data/content/published.json` (커밋)
   - 검증 전 원고까지 포함한 전체 → `src/data/content/drafts.local.json` (커밋하지 않음)
3. `published.json`이 바뀌었으면 커밋·푸시 → Cloudflare가 자동으로 공개 주소를 다시 빌드합니다.

## 검수 페이지 /admin/

확인 기한이 지났거나 다가오는 안내, 승인 대기 원고, 긴급 연락처 확인일, 운영자 결정 대기 목록을 한 화면에 보여 줘요.
승인 전 원고 제목이 들어 있어서 **로컬(`npm run dev:preview` → http://localhost:4321/admin/)과 미리보기 빌드에만** 만들어지고, 공개 빌드에는 없어요.

## 미리보기 (검증 전 초안 포함)

```bash
npm run dev:preview      # 로컬에서 초안 포함 화면 보기
npm run deploy:preview   # 초안 포함 빌드를 Cloudflare 미리보기 주소에 직접 업로드
```

미리보기 빌드는 모든 화면에 "검증 전 초안" 안내를 표시합니다. 초안 파일은 저장소에 없으므로 공개 주소에는 나오지 않습니다.
처음 한 번은 `npx wrangler login`으로 Cloudflare 계정에 로그인해야 합니다.

## Cloudflare Pages 설정

| 항목 | 값 |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (저장소 루트) |
| 환경 변수 | `NODE_VERSION` = `22` (`.nvmrc`와 같게) |

보안 헤더는 `public/_headers`에 있습니다.
