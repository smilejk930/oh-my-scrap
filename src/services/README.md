# Services (`src/services`)

## Overview
다단계 클라이언트 URL 추출 파이프라인(도메인 전용 공식 API → 자체 Cloudflare Workers 프록시 서버 → 최소 정보 그레이스풀 폴백) 및 공통 도메인 태그 유틸리티를 제공하는 `scraper.js`와, 다중 모델 폴백 기반의 Google Gemini 웹페이지·영상 요약(`gemini.js`) 서비스를 제공합니다.

## Interface
- `[gemini.js:analyzeContent]` — `async (content, language = "en", videoUrl = null) => Promise<{title: string, tags: string[], fullSummary: string}>`: 웹페이지 본문 텍스트 또는 YouTube 영상을 분석하여 제목, 태그 목록, 본문 요약을 반환합니다.
- `[scraper.js:scrapeUrl]` — `async (url, { checkDuration = true } = {}) => Promise<{title: string, thumbnail: string, content: string, description: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean}>`: 일반 웹 URL, GitHub 저장소 또는 YouTube 링크에서 메타데이터와 본문 텍스트를 추출합니다.
- `[scraper.js:FORCED_SITE_TAGS]` — 호스트네임(`news.hada.io` → `"GeekNews"`)에 대한 강제 사이트 태그 매핑 상수입니다.
- `[scraper.js:getForcedSiteTag]` — `(url: string) => string | null`: URL의 정규화된 호스트명이 `FORCED_SITE_TAGS`에 속하면 강제 태그 문자열을 반환합니다.
- `[scraper.js:generateBasicTags]` — `(url: string, isYoutubeVideo: boolean) => string[]`: YouTube 여부, 강제 사이트 태그, 11개 주요 도메인 매핑, 또는 호스트명 주요 세그먼트를 기반으로 기본 태그 배열을 생성합니다.

## Invariants
- `[gemini.js:analyzeContent]` — 입력 `content`는 최대 5,000자(`content.substring(0, 5000)`)로 잘리며, 비어 있거나 공백뿐인 경우 `"No content found on this page."`로 대체됩니다.
- `[gemini.js:analyzeContent]` — `/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/`와 일치하는 YouTube `videoUrl`은 `https://www.youtube.com/watch?v=${id}` 정규 형식으로 변환됩니다.
- `[gemini.js:recipeFullSummaryFormat]` — 분석 대상 콘텐츠가 음식/요리 레시피인 경우 마크다운 없이 고정된 텍스트 구조(영어: `[About]` / `[Ingredients]` / `[Instructions]`, 한국어: `[요리 소개]` / `[재료]` / `[만드는 법]`)로 `fullSummary`를 작성하고 `tags`에 `"Recipe"`(또는 `"레시피"`)를 포함하도록 프롬프트에서 강제합니다.
- `[gemini.js:analyzeContent]` — `modelsToTry` 목록(비디오 입력 시 비디오 지원 모델 부분집합, 일반 텍스트 입력 시 전체 폴백 모델 목록)을 순회하며 모델당 최대 `maxRetriesPerModel = 3`회 재시도합니다. `503` 또는 `404` 에러 발생 시 즉시 다음 모델로 넘어가며, `429` 에러 발생 시 `1000 * attempt` ms만큼 대기 후 재시도합니다.
- `[gemini.js:analyzeContent]` — 파싱된 AI JSON 응답에 `title`, `tags`, `fullSummary` 필드가 모두 존재해야 하며, 누락 시 `Error("Invalid format returned by AI")`를 던집니다. 모든 모델과 재시도가 실패하면 예외를 던지지 않고 폴백 객체(`{ title: "Analysis Failed (Manual entry needed)", tags: ["Misc"], fullSummary: ... }`)를 반환합니다.
- `[scraper.js:fetchWithTimeout]` — 모든 외부 HTTP `fetch` 요청에 `REQUEST_TIMEOUT_MS = 5000`ms(5초) 타임아웃을 강제합니다.
- `[scraper.js:YOUTUBE_AI_MAX_SECONDS]` — `checkDuration`이 `true`이고 `VITE_YOUTUBE_API_KEY`가 설정된 상태에서 YouTube 영상 길이가 180초를 초과하면 `skipAi = true` 및 `skipReason`을 설정하여 반환하며, YouTube oEmbed 실패 시에는 예외를 던지지 않고 `buildFallbackScrap(url)`으로 폴백합니다.
- `[scraper.js:parseGithubRepoUrl]` — `github.com/{owner}/{repo}` 저장소 루트 및 `/tree/{branch}` 경로(예약 경로 제외)에 한해 1단계 `scrapeGithubUrl`을 실행하여 `api.github.com/repos/{owner}/{repo}`와 `raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`를 병렬 조회하고 `https://opengraph.githubassets.com/1/${owner}/${repo}` 썸네일을 부여합니다. 두 요청 모두 실패 시 `buildFallbackScrap(url)`으로 단락합니다.
- `[scraper.js:extractNotionPageTitle]` — `*.notion.site` URL에서 추출된 제목이 `/^Notion\s*\|/i`(`NOTION_SHELL_TITLE_REGEX`)와 일치하면, URL 슬러그에서 후행 `NOTION_PAGE_ID_REGEX`(`/-?[0-9a-f]{32}$/i`)를 제거해 복원한 제목으로 `title`을 대체하고 `description`을 `""`로 비웁니다.
- `[scraper.js:isAntiBotInterstitial]` — Cloudflare 인터스티셜(`<title>Just a moment...`, `<title>Attention Required!`, `<title>Access Denied`, `__cf_chl_`, `challenges.cloudflare.com`, `cf-browser-verification`)이 포함된 응답을 거부합니다.
- `[scraper.js:scrapeUrl]` — 유효하지 않은 URL 구문 또는 비-`http(s):` 프로토콜일 때만 예외를 던지며, 네트워크/추출 실패 시에는 3단계 `buildFallbackScrap(url)`(`skipAi: true`, URL 슬러그/호스트 제목, Google S2 파비콘/OpenGraph 썸네일)을 반환합니다.

## Side Effects
- `[gemini.js:genAI]` — 모듈 로드 시점에 `import.meta.env.VITE_GEMINI_API_KEY`를 읽어 `GoogleGenerativeAI` 인스턴스를 생성합니다.
- `[gemini.js:analyzeContent]` — `model.generateContent(requestParts)`를 통해 Google Generative AI API로 외부 네트워크 요청을 수행하고, 실패 시 `console.warn` 및 `console.error`로 로그를 출력합니다.
- `[scraper.js:scrapeGithubUrl]` — `https://api.github.com/repos/{owner}/{repo}` 및 `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`로 5초 타임아웃 HTTP `fetch` 요청을 수행합니다.
- `[scraper.js:fetchHtmlViaCustomProxy]` — 자체 Cloudflare Workers 프록시(`VITE_SCRAPE_PROXY_URL`, 기본값 `https://oh-my-scrap-proxy.oh-my-scrap-proxy.workers.dev`)로 5초 타임아웃 HTTP `fetch` 요청을 수행합니다.
- `[scraper.js:fetchYoutubeDurationSeconds]` — `import.meta.env.VITE_YOUTUBE_API_KEY`를 읽어 `https://www.googleapis.com/youtube/v3/videos`로 HTTP `fetch` 요청을 보내고, 실패 시 `console.warn`으로 경고를 출력합니다.
- `[scraper.js:scrapeUrl]` — YouTube URL의 경우 `https://www.youtube.com/oembed`로 HTTP `fetch` 요청을 보내고, 2단계 HTML 경로에서는 브라우저 `DOMParser`로 HTML을 파싱하며, 폴백 전환 시 `console.warn`에 기록합니다.

## Verification
- Run: `npm run lint`
