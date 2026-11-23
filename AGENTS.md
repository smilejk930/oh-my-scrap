# AGENTS.md

이 문서는 `oh-my-scrap` 저장소에서 작업하는 AI 코딩 에이전트를 위한 프로젝트 운영 지침입니다. 모듈별 상세 인터페이스·불변식·부수 효과는 각 디렉터리의 `README.md`를 정본(Source of Truth)으로 참고하세요.

---

## 1. 프로젝트 개요 및 아키텍처

- **프론트엔드 (`src/`)**: React 19 + Vite 8 기반 SPA (JavaScript/JSX, TypeScript 미사용), Framer Motion, `lucide-react`, `date-fns`, 단일 전역 CSS(`src/index.css`)
- **인증·DB·호스팅**: Firebase Authentication(Google OAuth), Cloud Firestore(`asia-northeast3`), Firebase Hosting(`dist/`), PWA(`public/manifest.json` Web Share Target + `public/sw.js`)
- **백엔드 프록시 (`workers/scrape-proxy/`)**: Cloudflare Workers(`wrangler`) 기반 URL 스크래핑, YouTube 영상 길이/자막 추출, Gemini AI 콘텐츠 분석(`/analyze`) 및 보관함 질의응답(`/ask`) 프록시 서버

---

## 2. 디렉터리 구조 및 문서 지도

변경 전 관련 디렉터리의 `README.md`를 먼저 확인하세요.

- [README.md](./README.md) — 제품 기능, 전역 아키텍처, Global Invariants / Side Effects
- [src/README.md](./src/README.md) — 앱 진입점(`main.jsx`), 인증 게이트·공유 URL 라우팅(`App.jsx`), 전역 스타일(`index.css`)
  - [src/components/README.md](./src/components/README.md) — 스크랩 추가·재분석·Ask AI·퀵 도구 모달, 리스트/카드·2단 분할 뷰(`ScrapList`, `ScrapDetailPane`, `ScrapItem`), 도메인별 스마트 요약(`SmartSummaryView`), 타임캡슐(`RediscoverBanner`)
  - [src/context/README.md](./src/context/README.md) — `AuthContext`(인증·사용자 설정) 및 `ScrapContext`(실시간 구독·중복 감지·문서 변이)
  - [src/firebase/README.md](./src/firebase/README.md) — Firebase 앱 초기화 싱글턴(`auth`, `googleProvider`, `db`)
  - [src/i18n/README.md](./src/i18n/README.md) — 영·일·한·중(`en`, `ja`, `ko`, `zh`) 번역 사전 및 `useTranslation` 훅
  - [src/services/README.md](./src/services/README.md) — 클라이언트 스크래퍼(`scraper.js`) 및 Worker AI 호출(`gemini.js`)
- [workers/scrape-proxy/README.md](./workers/scrape-proxy/README.md) — Cloudflare Workers 엔드포인트, 보안·SSRF·인코딩·AI 모델 폴백 정책
- `.agents/skills/firebase-deploy/SKILL.md` — Firebase 배포 사전 검증 및 승인 절차

### 주의할 파일/디렉터리
- `src/App.css`, `src/assets/*`(`hero.png`, `react.svg`, `vite.svg`)는 미사용 Vite 스캐폴드 파일입니다.
- `.env`, `workers/scrape-proxy/.dev.vars`, `dist/`, `docs/`, `.firebase/`, `.wrangler/`는 Git 무시 대상입니다.

---

## 3. 개발·검증·배포 명령어

> **Windows PowerShell 규칙**: 이 워크스페이스는 Windows PowerShell 환경이므로 여러 명령어를 한 줄로 연결할 때 `&&` 대신 반드시 세미콜론(`;`)을 사용합니다.

### 프론트엔드 (프로젝트 루트)
- 개발 서버: `npm run dev`
- 린트 검사: `npm run lint` (`eslint .`, `dist` 제외 `**/*.{js,jsx}` 대상)
- 프로덕션 빌드: `npm run build` (`dist/` 생성)
- 빌드 프리뷰: `npm run preview`

### Cloudflare Workers (`workers/scrape-proxy`)
- 로컬 실행: `cd workers/scrape-proxy ; npm run dev` (로컬 시크릿은 `workers/scrape-proxy/.dev.vars` 사용)
- 배포: `cd workers/scrape-proxy ; npm run deploy`
- 실시간 로그: `cd workers/scrape-proxy ; npm run tail`
- 시크릿 등록: `cd workers/scrape-proxy ; npx wrangler secret put GEMINI_API_KEY` / `YOUTUBE_API_KEY`

### Firebase 배포
- `.agents/skills/firebase-deploy/SKILL.md` 절차를 따릅니다.
- Hosting 변경이 포함된 경우 배포 전 반드시 `npm run lint ; npm run build` 통과를 확인합니다.
- 변경 범위에 맞는 타겟만 배포합니다:
  - 웹 앱 코드만 변경: `npx firebase-tools deploy --only hosting`
  - Firestore 규칙/인덱스만 변경: `npx firebase-tools deploy --only firestore:rules` 또는 `firestore:indexes`
  - 통합 배포: `npx firebase-tools deploy --only hosting,firestore`

### 검증 기준
- 별도 단위 테스트 스크립트가 없으므로, 코드 변경 후 기본 검증으로 `npm run lint`와 `npm run build`를 실행해 오류가 없음을 확인합니다. (E2E/브라우저 점검이 필요한 경우 `devDependencies`의 `playwright` 활용 가능)

---

## 4. 핵심 보안 경계 및 아키텍처 불변식

아래 규칙은 어떤 기능 추가·리팩터링에서도 깨뜨리면 안 됩니다.

### 4.1 시크릿 및 API 키 격리
- `GEMINI_API_KEY`, `YOUTUBE_API_KEY`는 절대 클라이언트(`.env`의 `VITE_*`, `src/`)나 `workers/scrape-proxy/wrangler.toml`에 포함하지 않습니다.
- 클라이언트 `.env`에는 Firebase 공개 설정(`VITE_FIREBASE_*`)과 공개 프록시 URL(`VITE_SCRAPE_PROXY_URL`)만 둡니다.

### 4.2 테넌트 격리 및 Firestore 스키마 동기화
- `scraps/{scrapId}`는 `userId == request.auth.uid`, `users/{userId}`는 `request.auth.uid == userId`로 클라이언트(`ScrapContext`, `AuthContext`)와 `firestore.rules`에서 이중 강제됩니다.
- `scraps` 또는 `users` 문서에 필드를 추가·변경·제한 완화할 때는 반드시 `firestore.rules`의 `isValidScrapFields`, `allow create` / `allow update`의 `hasOnly([...])` 화이트리스트와 `firestore.indexes.json`을 함께 수정하고 배포 범위에 포함하세요.
- `scraps` 수정 시 `userId`와 `url`은 불변입니다.
- 허용된 `contentType` 값: `general`, `recipe`, `tech`, `video`, `place`, `product`.
- 클라이언트 크기 제한(Firestore 규칙과 일치): `title`/`originalTitle` ≤ 500자, `url`/`thumbnail` ≤ 2,048자(`http(s)://`), `tags` ≤ 10개, `fullSummary` ≤ 15,000자, `userNote` ≤ 5,000자, `checkedItems` ≤ 100개.

### 4.3 Worker 보안·SSRF·프롬프트 인젝션 방어
- `GET /health`와 `OPTIONS`를 제외한 모든 Worker 엔드포인트는 `ALLOWED_ORIGINS` 검증 + 유효한 Firebase Auth ID 토큰(`Authorization: Bearer <token>`, RS256 JWT) 검증을 통과해야 합니다.
- 외부 URL 요청은 `validateTargetUrl` 및 `fetchWithSafeRedirects`(최대 5홉, 매 홉 호스트 재검증, 사설 IP·루프백·메타데이터·DNS 리바인딩 차단)를 우회하지 않습니다.
- AI 프롬프트는 `systemInstruction`과 `<document>`(또는 `<archive>`/`<question>`) 경계 태그로 사용자 입력을 분리하며, `videoUrl`은 `YT_ID_REGEX`로 정규화해 임의 `fileUri` 주입을 차단합니다.
- 클라이언트에서 외부 링크를 열 때는 반드시 `src/services/scraper.js`의 `sanitizeHttpUrl` / `openSafeUrl`을 사용합니다(`javascript:` URL 금지; 북마클릿 `href`는 `QuickToolsModal`처럼 DOM ref를 통해 설정).

### 4.4 AI 쿼터 보호 및 YouTube 파이프라인
- `AddScrapDialog`의 전역 `useAi === false` 또는 `ReAnalyzeDialog`의 `localUseAi === false` 상태에서는 `analyzeContent` 호출 및 YouTube 재생시간/자막 조회(`checkDuration: false`)를 모두 건너뜁니다. (단, 미분석 항목의 `ScrapItem.handleDelayedAnalysis`는 항상 AI 분석 수행)
- YouTube 영상 분석 분기(`src/services/scraper.js`):
  1. `≤ 180초` (`YOUTUBE_AI_MAX_SECONDS`): 기본 멀티모달 분석
  2. `> 180초`: `GET /youtube-transcript` 자막(최소 30자, 최대 11,000자 균등 샘플링) 기반 텍스트 분석 우선
  3. 자막 없음 & `≤ 1,200초` (`YOUTUBE_MULTIMODAL_FALLBACK_MAX_SECONDS`, 20분): 저해상도 멀티모달 폴백(`lowResVideo: true` → `MEDIA_RESOLUTION_LOW`)
  4. 자막 없음 & `> 1,200초`: `skipAi: true`, 기본 태그 `["YouTube", "Video"]` 저장
- AI 입력 제한: `/analyze` 본문 최대 12,000자, `/ask` 질문 최대 500자·스크랩 최대 120건·컨텍스트 최대 38,000자.
- AI 모델 폴백 체인(`workers/scrape-proxy/src/index.js`): `gemini-4-hydrogen`(`thinkingLevel: "low"`) → `gemini-3.8-flash` → `gemini-flash-latest`.

### 4.5 태그 및 중복 감지 규칙
- AI 저장·재분석 시 태그는 `applyRequiredTags`를 거쳐 최대 3개로 제한되며, `news.hada.io`에는 `"GeekNews"`, YouTube 영상에는 `"YouTube"` 태그가 항상 보장됩니다(인라인 편집 시 최대 10개).
- 중복 URL 판별은 `normalizeUrlForDedup`을 기준으로 수행합니다.

---

## 5. 코딩·다국어(i18n)·UI 컨벤션

- **ESLint 규칙 (`eslint.config.js`)**: `@eslint/js` recommended, `eslint-plugin-react-hooks`(flat recommended), `eslint-plugin-react-refresh`가 적용됩니다. `no-unused-vars`는 `^[A-Z_]|^motion$` 패턴만 예외이므로 미사용 변수·임포트를 남기지 마세요.
- **다국어(i18n) 동기화**: 지원 언어는 `en`, `ja`, `ko`, `zh`입니다(`src/i18n/translations.js`). UI 텍스트나 에러 메시지를 추가·변경할 때는 반드시 `en`, `ja`, `ko`, `zh` 4개 사전을 모두 업데이트하세요. 새 언어를 추가할 경우 `firestore.rules`의 `users/{userId}` `language` 허용 목록 및 Worker 프롬프트/자막 언어 처리도 함께 검토해야 합니다.
- **스타일 및 반응형 UI**:
  - Tailwind 등 유틸리티 프레임워크 없이 `src/index.css`와 CSS 변수로 스타일링합니다.
  - 데스크톱(`>= 769px`) 독립 스크롤 2단 분할(`ScrapList` + `ScrapDetailPane`, `localStorage` 키 `oms_desktop_list_width`)과 모바일 확장 카드·하단 내비게이션 동작을 모두 고려하세요.
  - `localStorage` / `sessionStorage` 키(`oms_language`, `oms_desktop_list_width`, `oms_rediscover_dismissed`, `oms_pending_share_url`)의 하위 호환성을 유지하세요.

---

## 6. 문서 현행화 및 Git 컨벤션

- **모듈 문서 현행화**: 컴포넌트, 컨텍스트, 서비스, i18n, Worker 엔드포인트, Firestore 규칙 등 공개 인터페이스나 불변식·부수 효과가 변경되면 해당하는 디렉터리의 `README.md`와 루트 `README.md`도 함께 업데이트합니다.
- **커밋 메시지**: 반드시 **한국어**로 작성하며, 저장소의 기존 접두사 컨벤션(`Feat:`, `Fix:`, `Chore:`, `Refactor:`, `Docs:`)을 따릅니다.
- **작업 범위 준수**: 기존 워킹 트리에 사용자의 미커밋 변경이 있을 수 있으므로 요청된 범위 외 파일은 임의로 되돌리거나 수정하지 않습니다.
