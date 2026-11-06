# GitHub 업로드 · 자동 배포 · 데이터 수정 방법

**한 번만 연결해 두면, 그다음부터는 `content/` 파일을 GitHub에 올리기만 해도 사이트가 자동으로 바뀌어요.**

```
content/domestic-violence.json 수정 → GitHub에 커밋
        ↓ (자동)
Cloudflare Pages가 감지 → 형식 검사(check-content) → 빌드 → 1~2분 뒤 실제 주소 반영
        ↘ 검사에서 틀린 곳이 나오면 빌드 중단 → 실제 사이트는 직전 버전 그대로
```

---

## 0. 올리기 전에 정해 주세요

| 항목 | 왜 |
|---|---|
| **도면 사용권** | `src/assets/house-section.inner.svg`(집 단면도)가 공개 저장소에 그대로 올라가요. 올려도 되는 도면인지 먼저 확인해 주세요. 안 되면 말씀해 주세요 — 도면 없이도 동작하게 바꿀게요. |
| **GitHub 아이디** | 개인 계정이어야 해요(회사 계정 연결 금지). |

## 1. 올라가는 것 / 안 올라가는 것

올라가는 것(약 60개 파일): 사이트 코드(`src/`), 설정, `content/`(승인된 원고만), `docs/DECISIONS.md`, 스크립트.

자동으로 빠지는 것(`.gitignore`):

- `src/data/content/*.local.json` — 검증 전 초안
- `content/drafts/` — 승인 전 원고
- `.env.local` — 내 컴퓨터의 원자료 경로
- `node_modules/`, `dist/` — 설치·빌드 결과

원자료 폴더(1.9GB), 기획 문서, 편집안은 저장소 폴더 밖에 있어서 올라가지 않아요.

## 2. GitHub 저장소 만들기 (웹, 3분)

1. 개인 계정으로 https://github.com/new
2. Repository name: `blind-spot` · **Public** · README / .gitignore / license는 **모두 체크 해제**(빈 저장소)
3. **Create repository**
4. 커밋 작성자 메일(개인정보 보호용): GitHub → Settings → Emails → **Keep my email addresses private** 체크 → 아래에 나오는 `숫자+아이디@users.noreply.github.com`을 복사

## 3. 첫 업로드

### 방법 A (추천) — Claude에게 맡기기

GitHub **아이디**와 위 **noreply 메일**만 알려 주세요. 이 저장소에만 작성자를 설정하고(`--global` 아님, 회사 계정과 섞이지 않음) 첫 커밋까지 해 둘게요.
마지막 `git push`는 GitHub 로그인 창이 뜨므로 직접 개인 계정으로 로그인해 주세요.

### 방법 B — 직접 명령어 입력

`F:\blind spot\blind-spot` 폴더에서:

```bash
git config user.name "아이디"
git config user.email "숫자+아이디@users.noreply.github.com"
git add .
git status
git commit -m "첫 공개: 가정폭력 MVP"
git branch -M main
git remote add origin https://github.com/아이디/blind-spot.git
git push -u origin main
```

`git status`에서 `drafts.local.json`, `.env.local`, `content/drafts/`가 **보이지 않는지** 확인한 뒤 커밋해요.
로그인 창이 뜨면 **개인 계정**으로 로그인해요.

## 4. Cloudflare Pages 연결 (웹, 한 번만)

1. 개인 Cloudflare 계정 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub 연결 → `blind-spot` 저장소 선택
3. 설정:

| 항목 | 값 |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 환경 변수 | `NODE_VERSION` = `22` |

4. **Save and Deploy** → 몇 분 뒤 `https://blind-spot-xxx.pages.dev` 주소가 생겨요.

이제부터 `main`에 올라가는 모든 변경은 자동으로 배포돼요.

## 5. 데이터 고치기 (매번)

**GitHub 웹에서 (설치 없이):**

1. 저장소 → `content` → `domestic-violence.json` → 연필(✏️) 아이콘
2. 수정 → **Commit changes** → 무엇을 고쳤는지 한 줄 (예: `가정폭력 단기: 1366 확인일 갱신`)
3. 1~2분 뒤 사이트 확인

**반영이 안 될 때:** Cloudflare → Workers & Pages → blind-spot → **Deployments** → 실패(빨간색) 기록 → 로그에 `✖ 콘텐츠 검사 실패`와 함께 **어느 항목의 어느 칸**이 틀렸는지 한국어로 나와요. 고쳐서 다시 커밋하면 돼요. 그동안 실제 사이트는 직전 버전이 유지돼요.

**형식:** [content/README.md](../content/README.md) — 필수 칸, 비용 값, 날짜 형식, 승인 칸.

**승인 전 원고:** 공개 저장소라 GitHub에 올리면 누구나 볼 수 있어요. 승인 전 원고는 내 컴퓨터의 `content/drafts/`에 두고 `npm run dev:preview` → http://localhost:4321/admin/ 에서 검수해요. 승인하면 `domestic-violence.json`으로 옮겨 커밋해요.

## 6. 검수 페이지 /admin/

- 볼 수 있는 곳: 내 컴퓨터(`npm run dev:preview` → `/admin/`), 미리보기 배포(`npm run deploy:preview`).
- 공개 주소에는 없어요 (승인 전 원고 제목이 들어 있어서).
- 미리보기 주소는 아는 사람 누구나 열 수 있어요. 잠그려면 Cloudflare Access 설정이 필요해요(결정 대기).
