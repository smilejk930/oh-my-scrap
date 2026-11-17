# Services (`src/services`)

## Overview
다단계 클라이언트 URL 추출 파이프라인(도메인 전용 공식 API → 인증된 자체 Cloudflare Workers 프록시 서버 → 최소 정보 그레이스풀 폴백), 안전 URL 유틸리티(`sanitizeHttpUrl`, `openSafeUrl`)를 제공하는 `scraper.js`와, Cloudflare Worker(`/analyze`)를 통해 다중 모델 폴백 기반의 Google Gemini 웹페이지·영상 요약을 수행하는 `gemini.js` 서비스를 제공합니다.

## Interface
- `[gemini.js:analyzeContent]` — `async (content, language = "en", videoUrl = null) => Promise<{title: string, tags: string[], fullSummary: string}>`: Cloudflare Worker `POST /analyze` 엔드포인트에 Firebase Auth ID 토큰과 함께 요청하여 웹페이지 본문 텍스트 또는 YouTube 영상을 분석한 제목, 태그 목록, 본문 요약을 반환합니다.
- `[scraper.js:scrapeUrl]` — `async (url, { checkDuration = true } = {}) => Promise<{title: string, thumbnail: string, content: string, description: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean}>`: 일반 웹 URL, GitHub 저장소 또는 YouTube 링크에서 메타데이터와 본문 텍스트를 추출합니다.
- `[scraper.js:getProxyBaseUrl]` — `() => string`: 정규화된 Cloudflare Worker 프록시 기본 URL을 반환합니다.
- `[scraper.js:getAuthHeaders]` — `async () => Promise<Record<string, string>>`: 현재 로그인된 Firebase 사용자의 ID 토큰을 읽어 `Authorization: Bearer <token>` 헤더 객체를 반환합니다.
- `[scraper.js:fetchWithTimeout]` — `async (url, options = {}, timeoutMs = 5000) => Promise<Response>`: 지정된 타임아웃(`AbortSignal.timeout` 또는 `AbortController` 폴백)을 적용해 `fetch`를 호출합니다.
- `[scraper.js:sanitizeHttpUrl]` — `(rawUrl: string, baseUrl?: string) => string | null`: `http:` 또는 `https:` 프로토콜 URL만 정규화해 반환하고, 그 외 프로토콜(`javascript:`, `data:` 등)이나 잘못된 URL은 `null`을 반환합니다.
- `[scraper.js:openSafeUrl]` — `(rawUrl: string) => void`: `sanitizeHttpUrl`로 검증된 URL만 `window.open(safeUrl, "_blank", "noopener,noreferrer")`로 엽니다.
- `[scraper.js:FORCED_SITE_TAGS]` — 호스트네임(`news.hada.io` → `"GeekNews"`)에 대한 강제 사이트 태그 매핑 상수입니다.
- `[scraper.js:getForcedSiteTag]` — `(url: string) => string | null`: URL의 정규화된 호스트명이 `FORCED_SITE_TAGS`에 속하면 강제 태그 문자열을 반환합니다.
- `[scraper.js:generateBasicTags]` — `(url: string, isYoutubeVideo: boolean) => string[]`: YouTube 여부, 강제 사이트 태그, 11개 주요 도메인 매핑, 또는 호스트명 주요 세그먼트를 기반으로 기본 태그 배열을 생성합니다.

## Invariants
- `[gemini.js:analyzeContent]` — 클라이언트 번들에는 Gemini API 키가 포함되지 않으며, 입력 `content`는 최대 5,000자(`content.substring(0, 5000)`)로 잘린 뒤 `60,000`ms 타임아웃으로 Worker `POST /analyze`를 호출합니다.
- `[gemini.js:analyzeContent]` — Worker 응답에 `title`, 배열형 `tags`, `fullSummary` 필드가 모두 존재해야 하며, 누락되거나 요청 실패 시 예외를 던지지 않고 폴백 객체(`{ title: "Analysis Failed (Manual entry needed)", tags: ["Misc"], fullSummary: ... }`)를 반환합니다.
- `[scraper.js:fetchWithTimeout]` — 일반 외부 `fetch` 요청에 기본 `REQUEST_TIMEOUT_MS = 5000`ms(5초) 타임아웃을 강제합니다.
- `[scraper.js:YOUTUBE_AI_MAX_SECONDS]` — `checkDuration`이 `true`일 때 Worker `GET /youtube-duration`을 통해 조회한 YouTube 영상 길이가 180초를 초과하면 `skipAi = true` 및 `skipReason`을 설정하여 반환하며, YouTube oEmbed 실패 시에는 예외를 던지지 않고 `buildFallbackScrap(url)`으로 폴백합니다.
- `[scraper.js:parseGithubRepoUrl]` — `github.com/{owner}/{repo}` 저장소 루트 및 `/tree/{branch}` 경로(예약 경로 제외)에 한해 1단계 `scrapeGithubUrl`을 실행하여 `api.github.com/repos/{owner}/{repo}`와 `raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`를 병렬 조회하고 `https://opengraph.githubassets.com/1/${owner}/${repo}` 썸네일을 부여합니다. 두 요청 모두 실패 시 `buildFallbackScrap(url)`으로 단락합니다.
- `[scraper.js:extractNotionPageTitle]` — `*.notion.site` URL에서 추출된 제목이 `/^Notion\s*\|/i`(`NOTION_SHELL_TITLE_REGEX`)와 일치하면, URL 슬러그에서 후행 `NOTION_PAGE_ID_REGEX`(`/-?[0-9a-f]{32}$/i`)를 제거해 복원한 제목으로 `title`을 대체하고 `description`을 `""`로 비웁니다.
- `[scraper.js:sanitizeHttpUrl]` — HTML에서 추출한 `og:image` 및 `<link rel="icon">` 썸네일은 `sanitizeHttpUrl(candidate, url)`로 `http:`/`https:` 검증을 거치며 실패 시 `getGoogleFaviconUrl(url)`로 폴백합니다.
- `[scraper.js:isAntiBotInterstitial]` — Cloudflare 인터스티셜(`<title>Just a moment...`, `<title>Attention Required!`, `<title>Access Denied`, `__cf_chl_`, `challenges.cloudflare.com`, `cf-browser-verification`)이 포함된 응답을 거부합니다.
- `[scraper.js:scrapeUrl]` — 유효하지 않은 URL 구문 또는 비-`http(s):` 프로토콜일 때만 예외를 던지며, 네트워크/추출 실패 시에는 3단계 `buildFallbackScrap(url)`(`skipAi: true`, URL 슬러그/호스트 제목, Google S2 파비콘/OpenGraph 썸네일)을 반환합니다.

## Side Effects
- `[gemini.js:analyzeContent]` — `getAuthHeaders()`로 Firebase ID 토큰을 획득해 Cloudflare Worker `POST ${baseUrl}/analyze` 엔드포인트로 요청을 보내며, 실패 시 `console.error`로 로그를 출력합니다.
- `[scraper.js:scrapeGithubUrl]` — `https://api.github.com/repos/{owner}/{repo}` 및 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`로 5초 타임아웃 HTTP `fetch` 요청을 수행합니다.
- `[scraper.js:fetchHtmlViaCustomProxy]` — Firebase ID 토큰을 첨부해 자체 Cloudflare Workers 프록시(`${baseUrl}/?url=...`)로 5초 타임아웃 HTTP `fetch` 요청을 수행합니다.
- `[scraper.js:fetchYoutubeDurationSeconds]` — Firebase ID 토큰을 첨부해 Cloudflare Workers 프록시(`${baseUrl}/youtube-duration?videoId=...`)로 HTTP `fetch` 요청을 보내고, 실패 시 `console.warn`으로 경고를 출력합니다.
- `[scraper.js:scrapeUrl]` — YouTube URL의 경우 `https://www.youtube.com/oembed`로 HTTP `fetch` 요청을 보내고, 2단계 HTML 경로에서는 브라우저 `DOMParser`로 HTML을 파싱하며, 폴백 전환 시 `console.warn`에 기록합니다.
- `[scraper.js:openSafeUrl]` — 안전한 `http:`/`https:` URL에 한해 `window.open(..., "_blank", "noopener,noreferrer")`를 호출합니다.

## Verification
- Run: `npm run lint`
