# Services (`src/services`)

## Overview
CORS 프록시 폴백 및 YouTube 메타데이터/재생시간 API를 활용한 클라이언트 측 URL 스크래핑(`scraper.js`)과, 다중 모델 폴백 기반의 Google Gemini 웹페이지·영상 요약(`gemini.js`) 서비스를 제공합니다.

## Interface
- `[gemini.js:analyzeContent]` — `async (content, language = "en", videoUrl = null) => Promise<{title: string, tags: string[], fullSummary: string}>`: 웹페이지 본문 텍스트 또는 YouTube 영상을 분석하여 제목, 태그 목록, 본문 요약을 반환합니다.
- `[scraper.js:scrapeUrl]` — `async (url, { checkDuration = true } = {}) => Promise<{title: string, thumbnail: string, content: string, description: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean}>`: 일반 웹 URL 또는 YouTube 링크에서 메타데이터와 본문 텍스트를 추출합니다.

## Invariants
- `[gemini.js:analyzeContent]` — 입력 `content`는 최대 5,000자(`content.substring(0, 5000)`)로 잘리며, 비어 있거나 공백뿐인 경우 `"No content found on this page."`로 대체됩니다.
- `[gemini.js:analyzeContent]` — `/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/`와 일치하는 YouTube `videoUrl`은 `https://www.youtube.com/watch?v=${id}` 정규 형식으로 변환됩니다.
- `[gemini.js:recipeFullSummaryFormat]` — 분석 대상 콘텐츠가 음식/요리 레시피인 경우 마크다운 없이 고정된 텍스트 구조(영어: `[About]` / `[Ingredients]` / `[Instructions]`, 한국어: `[요리 소개]` / `[재료]` / `[만드는 법]`)로 `fullSummary`를 작성하고 `tags`에 `"Recipe"`(또는 `"레시피"`)를 포함하도록 프롬프트에서 강제합니다.
- `[gemini.js:analyzeContent]` — `modelsToTry` 목록(비디오 입력 시 비디오 지원 모델 부분집합, 일반 텍스트 입력 시 전체 폴백 모델 목록)을 순회하며 모델당 최대 `maxRetriesPerModel = 3`회 재시도합니다. `503` 또는 `404` 에러 발생 시 즉시 다음 모델로 넘어가며, `429` 에러 발생 시 `1000 * attempt` ms만큼 대기 후 재시도합니다.
- `[gemini.js:analyzeContent]` — 파싱된 AI JSON 응답에 `title`, `tags`, `fullSummary` 필드가 모두 존재해야 하며, 누락 시 `Error("Invalid format returned by AI")`를 던집니다. 모든 모델과 재시도가 실패하면 예외를 던지지 않고 폴백 객체(`{ title: "Analysis Failed (Manual entry needed)", tags: ["Misc"], fullSummary: ... }`)를 반환합니다.
- `[scraper.js:YOUTUBE_AI_MAX_SECONDS]` — `checkDuration`이 `true`이고 `VITE_YOUTUBE_API_KEY`가 설정된 상태에서 YouTube 영상 길이가 180초를 초과하면 `skipAi = true` 및 `skipReason`을 설정하여 반환합니다.
- `[scraper.js:extractNotionPageTitle]` — `*.notion.site` URL에서 추출된 제목이 `/^Notion\s*\|/i`(`NOTION_SHELL_TITLE_REGEX`)와 일치하면, URL 슬러그에서 후행 `NOTION_PAGE_ID_REGEX`(`/-?[0-9a-f]{32}$/i`)를 제거해 복원한 제목으로 `title`을 대체하고 `description`을 `""`로 비웁니다.
- `[scraper.js:rewriteHostForFetch]` — 프록시 요청 시 `reddit.com` 및 `*.reddit.com` 호스트명을 정적 HTML 추출이 가능한 `old.reddit.com`으로 변환하며, 실패 시 원본 URL로 재시도합니다.
- `[scraper.js:isAntiBotInterstitial]` — Cloudflare 등 봇 차단 인터스티셜 패턴(`<title>Just a moment...`, `__cf_chl_`, `challenges.cloudflare.com`, `cf-browser-verification`)이 포함된 프록시 응답을 거부합니다.
- `[scraper.js:scrapeUrl]` — 스크래핑 중 복구되지 않은 에러가 발생하면 `new Error("Failed to fetch URL information.")`를 던집니다.

## Side Effects
- `[gemini.js:genAI]` — 모듈 로드 시점에 `import.meta.env.VITE_GEMINI_API_KEY`를 읽어 `GoogleGenerativeAI` 인스턴스를 생성합니다.
- `[gemini.js:analyzeContent]` — `model.generateContent(requestParts)`를 통해 Google Generative AI API로 외부 네트워크 요청을 수행하고, 실패 시 `console.warn` 및 `console.error`로 로그를 출력합니다.
- `[scraper.js:fetchHtmlViaProxies]` — 외부 CORS 프록시(`https://api.codetabs.com/v1/proxy`, `https://corsproxy.io/`, `https://api.allorigins.win/get`)로 HTTP `fetch` 요청을 수행합니다.
- `[scraper.js:fetchYoutubeDurationSeconds]` — `import.meta.env.VITE_YOUTUBE_API_KEY`를 읽어 `https://www.googleapis.com/youtube/v3/videos`로 HTTP `fetch` 요청을 보내고, 실패 시 `console.warn`으로 경고를 출력합니다.
- `[scraper.js:scrapeUrl]` — YouTube URL의 경우 `https://www.youtube.com/oembed`로 HTTP `fetch` 요청을 보내고, 일반 웹페이지의 경우 브라우저 `DOMParser`로 HTML을 파싱하며, 경고/에러를 `console.warn` 및 `console.error`에 기록합니다.

## Verification
- Run: `npm run lint`
