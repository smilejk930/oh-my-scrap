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
- `[gemini.js:analyzeContent]` — 입력 `content`는 최대 12,000자로 잘리며 일반 요청은 `60,000`ms, 영상 멀티모달 요청(`videoUrl`)은 `90,000`ms 타임아웃으로 Worker `POST /analyze`를 호출합니다. 실패 시 예외를 던지지 않고 `{ title: "Analysis Failed (Manual entry needed)", tags: ["Misc"], contentType: "general", fullSummary: ... }`를 반환합니다.
- `[gemini.js:askMyScraps]` — 빈 질문이면 예외를 발생시키며, 스크랩 목록은 최대 120건(요약 350자·메모 150자 제한)으로 축약해 `35,000`ms 타임아웃으로 Worker `POST /ask`를 호출합니다.
- `[scraper.js:YOUTUBE_AI_MAX_SECONDS]` — `checkDuration`이 `true`이고 영상 길이가 180초를 초과하면 `fetchYoutubeTranscript`로 자막을 조회합니다. 자막이 30자 이상이면 `useVideoMultimodal: false`, `skipAi: false`로 텍스트 기반 AI 요약으로 전환하며, 자막 조회가 실패하더라도 1,200초(20분) 이하 영상은 `useVideoMultimodal: true`, `lowResVideo: true`로 저해상도 멀티모달 폴백을 수행하고 20분 초과 시에만 `skipAi: true`를 반환합니다.
- `[scraper.js:scrapeGithubUrl]` — GitHub 저장소 루트 조회 시 `README.md` 최대 10,000자를 읽고 `contentTypeHint: "tech"`를 설정합니다.
- `[scraper.js:normalizeUrlForDedup]` — 유효하지 않거나 비-`http(s):` URL에는 `null`을 반환합니다.

## Side Effects
- `[gemini.js]` — `getAuthHeaders()`로 Firebase ID 토큰을 획득해 Cloudflare Worker `POST /analyze` 및 `POST /ask` 엔드포인트로 요청을 보냅니다.
- `[scraper.js]` — GitHub API/Raw, YouTube oEmbed, 자체 Worker(`/?url=...`, `/youtube-duration`, `/youtube-transcript`)에 HTTP `fetch` 요청을 수행하며 `openSafeUrl`로 새 탭을 엽니다.

## Verification
- Run: `npm run lint`
