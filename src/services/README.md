# Services (`src/services`)

## Overview
다단계 클라이언트 URL 추출 파이프라인(도메인 전용 공식 API → 인증된 자체 Cloudflare Workers 프록시 서버 → YouTube 자막 폴백 → 최소 정보 그레이스풀 폴백), URL 중복 정규화·추출 유틸리티를 제공하는 `scraper.js`와, Cloudflare Worker(`/analyze`, `/ask`)를 통해 Gemini AI 요약 및 보관함 질의응답을 수행하는 `gemini.js` 서비스를 제공합니다.

## Interface
- `[gemini.js:analyzeContent]` — `async (content, language = "en", videoUrl = null, options = {}) => Promise<{title, tags, contentType, fullSummary}>`: Worker `POST /analyze`로 도메인별 스마트 템플릿 요약과 `contentType`을 생성합니다.
- `[gemini.js:askMyScraps]` — `async (question, scraps = [], language = "en") => Promise<{answer, matchedIds, followUpSuggestions}>`: 질문 토큰 매칭 및 최신순으로 최대 120건의 스크랩을 선별해 Worker `POST /ask`에 전달하고 답변·출처 ID·후속 질문을 반환합니다.
- `[scraper.js:scrapeUrl]` — `async (url, { checkDuration = true, language = "en" } = {}) => Promise<{title, thumbnail, content, description, skipAi, skipReason, isYoutubeVideo, useVideoMultimodal, lowResVideo, contentTypeHint}>`: 일반 웹, GitHub, YouTube(3분 초과 시 자막 기반 분석 전환, 자막 실패 시 20분 이하 저해상도 멀티모달 폴백) 콘텐츠를 추출합니다.
- `[scraper.js:fetchYoutubeTranscript]` — `async (videoId, language = "en")`: Worker `GET /youtube-transcript`를 호출해 자막 텍스트를 조회합니다.
- `[scraper.js:extractYoutubeVideoId]` — URL에서 11자리 YouTube 영상 ID를 추출합니다.
- `[scraper.js:extractFirstUrl]` — 임의의 텍스트(공유/클립보드 문자열)에서 첫 번째 유효 `http(s):` URL을 추출합니다.
- `[scraper.js:normalizeUrlForDedup]` — YouTube ID 정규화, `www.` 제거, UTM/추적 파라미터 제거를 적용해 중복 판별용 정규 URL을 반환합니다.
- `[scraper.js:applyRequiredTags]` — 강제 사이트 태그(`FORCED_SITE_TAGS`) 및 `"YouTube"` 태그를 중복 없이 맨 앞에 보장하고 최대 3개로 제한합니다.
- `[scraper.js:getProxyBaseUrl]`, `[scraper.js:getAuthHeaders]`, `[scraper.js:fetchWithTimeout]`, `[scraper.js:sanitizeHttpUrl]`, `[scraper.js:openSafeUrl]`, `[scraper.js:FORCED_SITE_TAGS]`, `[scraper.js:getForcedSiteTag]`, `[scraper.js:generateBasicTags]`

## Invariants
- `[gemini.js:analyzeContent]` — 입력 `content`는 비어 있으면 `"No content found on this page."`로 대체되고 최대 12,000자로 잘리며, 일반 요청은 `60,000`ms, 영상 멀티모달 요청(`videoUrl`)은 `90,000`ms 타임아웃으로 Worker `POST /analyze`를 호출합니다. 응답에 `contentType`이 없으면 `videoUrl ? "video" : "general"`로 폴백하며, 실패 시 예외를 던지지 않고 `[translations.js:translate]` 기반 다국어 폴백 객체(`en`/`ko`/`zh`)를 반환합니다.
- `[gemini.js:askMyScraps]` — 빈 질문이면 지역화된 예외를 발생시키며, 2자 이상 질문 토큰(중국어 한자 2-gram 포함)의 제목·태그·요약·메모 일치 횟수(동률 시 원래 순서 유지)로 정렬해 최대 120건(태그 5개·요약 350자·메모 150자 제한, 제목 누락 시 `"Untitled"`)으로 축약한 뒤 `35,000`ms 타임아웃으로 Worker `POST /ask`를 호출합니다. 응답의 `answer`가 문자열이 아니면 예외를 던집니다.
- `[scraper.js:scrapeUrl]` — 유효하지 않은 URL 형식이거나 `http:`/`https:` 외 프로토콜일 때는 폴백하지 않고 지역화된 예외를 발생시킵니다.
- `[scraper.js:YOUTUBE_AI_MAX_SECONDS]` / `[scraper.js:YOUTUBE_MULTIMODAL_FALLBACK_MAX_SECONDS]` — `checkDuration`이 `true`이고 영상 길이가 180초를 초과하면 `fetchYoutubeTranscript`(`TRANSCRIPT_TIMEOUT_MS = 18,000`ms)로 자막을 조회합니다. 자막이 30자 이상이면 `useVideoMultimodal: false`, `skipAi: false`로 텍스트 기반 AI 요약으로 전환하며, 자막 조회가 실패하더라도 1,200초(20분) 이하 영상은 `useVideoMultimodal: true`, `lowResVideo: true`로 저해상도 멀티모달 폴백을 수행하고 20분 초과 시에만 `skipAi: true`를 반환합니다.
- `[scraper.js:parseGithubRepoUrl]` / `[scraper.js:scrapeGithubUrl]` — GitHub 저장소 루트(`/{owner}/{repo}`)와 브랜치 루트 트리(`/{owner}/{repo}/tree/{branch}`)에 적용되며(`GITHUB_RESERVED_SEGMENTS` 및 `/issues/*`·`/pull/*`·`/blob/*`·`/releases/*` 하위 경로는 2단계 프록시로 위임), `README.md` 최대 10,000자를 읽고 `contentTypeHint: "tech"`를 설정합니다. REST API와 Raw README가 모두 실패하면 `buildFallbackScrap`으로 폴백(`skipAi: true`, `contentTypeHint: null`)합니다.
- `[scraper.js:extractNotionPageTitle]` / `[scraper.js:isAntiBotInterstitial]` / `[scraper.js:buildFallbackScrap]` — 프록시 응답이 Cloudflare 등 봇 차단 인터스티셜이거나 빈 페이지·복원 불가 Notion 마케팅 셸(`"Notion | ..."`)이면 `buildFallbackScrap`으로 전환합니다. `*.notion.site` 셸 제목은 URL slug에서 페이지 제목을 복원하며, `buildFallbackScrap`은 Notion slug → GitHub `owner/repo` → URL 경로/호스트명 순으로 제목을, YouTube 썸네일 → GitHub OpenGraph → Google Favicon 순으로 썸네일을 복원하고 `skipAi: true`를 반환합니다.
- `[scraper.js:generateBasicTags]` — YouTube는 `["YouTube", "Video"]`, 그 외에는 `FORCED_SITE_TAGS` → 11개 주요 도메인 매핑(`knownDomains`) → 무의미 접두어(`blog`, `www`, `app`, `m`, `news`, `shop`)를 제외한 호스트명 세그먼트(첫 글자 대문자) 순으로 태그를 생성하며, URL 파싱 실패 시 `["Web"]`으로 폴백합니다.
- `[scraper.js:getProxyBaseUrl]` / `[scraper.js:fetchWithTimeout]` / `[scraper.js:sanitizeHttpUrl]` / `[scraper.js:openSafeUrl]` / `[scraper.js:normalizeUrlForDedup]` — `getProxyBaseUrl`은 `VITE_SCRAPE_PROXY_URL` 미설정 시 `https://oh-my-scrap-proxy.smilejk930.workers.dev`를 기본값으로 사용하고, `fetchWithTimeout`은 기본 타임아웃 `5,000`ms를 적용합니다. `sanitizeHttpUrl`은 선택적 `baseUrl`을 해석해 `http:`/`https:`만 허용하며 `normalizeUrlForDedup`은 유효하지 않거나 비-`http(s):` URL에 `null`을 반환합니다. `openSafeUrl`은 검증된 URL만 `_blank`(`noopener,noreferrer`)로 열고 차단 시 `console.warn`을 출력합니다.

## Side Effects
- `[gemini.js]` — `getAuthHeaders()`로 Firebase ID 토큰을 획득해 Cloudflare Worker `POST /analyze` 및 `POST /ask` 엔드포인트로 요청을 보냅니다.
- `[scraper.js]` — GitHub API/Raw, YouTube oEmbed, 자체 Worker(`/?url=...`, `/youtube-duration`, `/youtube-transcript`)에 HTTP `fetch` 요청을 수행하고, `DOMParser`로 프록시 HTML을 파싱하며, 폴백 썸네일로 Google Favicon URL(`https://www.google.com/s2/favicons`)을 생성하고 `openSafeUrl`로 새 탭을 엽니다.

## Verification
- Run: `npm run lint`
