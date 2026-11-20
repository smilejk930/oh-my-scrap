# Cloudflare Workers Scrape & AI Proxy (`workers/scrape-proxy`)

## Overview
`oh-my-scrap` 프론트엔드의 URL 스크래핑, YouTube 영상 길이 조회 및 자막 추출, Gemini AI 콘텐츠 분석, 보관함 질의응답(Ask AI)을 안전하게 대행하는 전용 Cloudflare Workers 엣지 백엔드 프록시 서버입니다. 유료 API 키(`GEMINI_API_KEY`, `YOUTUBE_API_KEY`)를 클라이언트 번들에서 완전히 분리하여 Worker Secrets로 보관하며, 엄격한 Origin 화이트리스트, Firebase Auth ID 토큰 검증, SSRF 방어 및 안전한 응답 헤더를 적용합니다.

## 주요 기능
1. **보안 (엄격한 Origin 검증 · Firebase Auth JWT 검증 · SSRF 방어)**
   - `[src/index.js:getAllowedOrigin]` / `[src/index.js:verifyFirebaseIdToken]` — `GET /health` 및 `OPTIONS`를 제외한 모든 요청은 `[wrangler.toml:ALLOWED_ORIGINS]`에 등록된 `Origin` 헤더가 있어야 하며(`403`), `Authorization: Bearer <Firebase ID Token>` 헤더의 RS256 서명 및 클레임(`aud`, `iss`, `sub`, `exp`, `iat`)을 `[wrangler.toml:FIREBASE_PROJECT_ID]`(기본 `"oh-my-scrap"`)와 Google 공개 JWK(`[src/index.js:getGoogleSecureTokenJwks]`, 1시간 캐시·미등록 `kid` 1분 쿨다운 갱신)로 검증합니다(`401`).
   - `[src/index.js:isBlockedHostname]` / `[src/index.js:validateTargetUrl]` / `[src/index.js:fetchWithSafeRedirects]` — `localhost`·`.localhost`·`.local`·`.internal`, 루프백(`127.0.0.0/8`, `::1`), `0.0.0.0/8`·`::`, 사설 IP 대역(`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), CGNAT(`100.64.0.0/10`), 링크 로컬/클라우드 메타데이터(`169.254.0.0/16`, `metadata.google.internal`), 멀티캐스트·예약 대역(`>= 224.0.0.0`), IPv6 ULA·링크로컬·IPv4-mapped(`fc00::/7`, `fe80::/10`, `::ffff:*`), DNS 리바인딩 도메인(`.nip.io`, `.sslip.io`, `.xip.io`), 정수/8진수/16진수 IP 우회 표기를 차단하며 리다이렉트(최대 5홉) 시 매 홉마다 대상 호스트를 재검증합니다.
   - `[src/index.js:default.fetch]` — 스크래핑 응답은 `[wrangler.toml:MAX_RESPONSE_BYTES]`(기본 2MB / `2097152` 바이트)로 절단하고 `Content-Type: text/plain; charset=utf-8`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` 헤더로 반환해 프록시 도메인 내 XSS 실행을 차단합니다.
2. **브라우저 헤더 스푸핑 & 한글 인코딩 변환**
   - `[src/index.js:BROWSER_USER_AGENT]` / `[src/index.js:fetchWithSafeRedirects]` — 최신 데스크톱 Chrome 브라우저 `User-Agent`, `Accept-Language: ko-KR` 등의 헤더를 주입해 단순 봇 차단을 우회합니다.
   - `[src/index.js:decodeHtmlBuffer]` — `Content-Type` 헤더나 `<meta charset>`에 `euc-kr`/`ks_c_5601-1987`/`cp949` 또는 `gbk`/`gb2312`/`gb18030`이 지정된 구형 한국어·중국어 웹페이지를 자동으로 감지해 UTF-8로 변환합니다.
3. **사이트별 맞춤 추출**
   - **Notion 공개 페이지 (`*.notion.site`, `[src/index.js:trySynthesizeNotionHtml]`)**: `loadPageChunk` API를 호출해 실제 페이지 제목·커버 이미지·본문 텍스트 블록을 추출하고 정적 HTML을 합성해 반환합니다.
   - **Reddit (`reddit.com` / `*.reddit.com`, `[src/index.js:trySynthesizeRedditHtml]`, `[src/index.js:default.fetch]`)**: `/comments/` 경로는 `www.reddit.com/...json?raw_json=1` 엔드포인트에서 본문과 상위 댓글 최대 5개를 추출해 정적 HTML로 합성합니다. JSON 합성이 실패하거나 게시글 외 Reddit URL인 경우 `old.reddit.com`으로 호스트를 전환해 일반 HTTP fetch를 시도하고, 실패 시 원본 `targetUrl`로 재시도합니다.
4. **API 키 격리 및 AI·YouTube 엔드포인트 (`GEMINI_API_KEY`, `YOUTUBE_API_KEY`)**
   - **`GET /youtube-duration?videoId=<id>` (`[src/index.js:handleYoutubeDuration]`)**: 서버 시크릿 `YOUTUBE_API_KEY`로 YouTube Data API v3 영상 길이를 조회해 `{ seconds }`를 반환합니다.
   - **`GET /youtube-transcript?videoId=<id>&lang=<ko|en|zh>` (`[src/index.js:handleYoutubeTranscript]`, `[src/index.js:INNERTUBE_TRANSCRIPT_CLIENTS]`, `[src/index.js:rankCaptionTracks]`, `[src/index.js:parseCaptionEntries]`, `[src/index.js:formatTranscriptBlocks]`)**: 3분 초과 YouTube 영상 요약용으로 `ANDROID`·`IOS` 다중 InnerTube 클라이언트로 자막 트랙을 순차 조회하고(상위 3개 트랙 시도, `YT_ALLOWED_TRANSCRIPT_HOSTS` HTTPS 호스트 SSRF 검증, JSON3/XML 이중 파싱), 약 35초 단위 `[MM:SS]`/`[H:MM:SS]` 블록 포맷(최소 30자 유효성, 11,000자 초과 시 전체 구간 균등 샘플링)으로 가공해 Edge Cache(3,600초, `X-Proxy-Cache: HIT | MISS`)와 함께 반환합니다. 실패 응답은 캐시하지 않습니다.
   - **`POST /analyze` (`[src/index.js:handleAnalyze]`, `[src/index.js:callGeminiWithFallback]`)**: 서버 시크릿 `GEMINI_API_KEY`와 `systemInstruction` + `<document>` 경계 분리(입력 본문 12,000자 절단 및 `</?document>` 제거)를 통해 간접 프롬프트 인젝션을 방어하며, `videoUrl`은 `YT_ID_REGEX`로 정규화해 임의 `fileUri` 주입을 차단합니다. 도메인별 스마트 템플릿(`ALLOWED_CONTENT_TYPES`: `general`, `recipe`, `tech`, `video`, `place`, `product`) 분석과 `tags` 최대 3개 제한을 적용합니다. 모델 체인(`TEXT_GEMINI_MODELS`/`VIDEO_GEMINI_MODELS`)은 `gemini-4-hydrogen`(`thinkingLevel: "low"`) → `gemini-3.8-flash` → `gemini-flash-latest`이며, 일반 요청은 25초 타임아웃·모델당 최대 3회 재시도, `lowResVideo: true` YouTube 요청은 `MEDIA_RESOLUTION_LOW`·40초 타임아웃·최대 2회 재시도를 적용합니다(`mediaResolution` HTTP 400 거부 시 옵션 제거 재시도, HTTP 429 `1000 * attempt`ms 백오프, 404/503/타임아웃 시 즉시 다음 모델 전환).
   - **`POST /ask` (`[src/index.js:handleAsk]`)**: 사용자의 저장된 스크랩 컨텍스트(`<archive>`)와 질문(`<question>`)을 분리해 `TEXT_GEMINI_MODELS` 전체 폴백 체인(25초 타임아웃, 모델당 최대 3회 재시도, `thinkingLevel: "low"`)으로 답변·근거 스크랩 ID(`matchedIds` 유효 ID 필터링·중복 제거 최대 6건)·후속 질문 추천(`followUpSuggestions` 최대 3건)을 반환합니다. 질문에 한글(`[가-힣]`) 또는 중국어 한자(`[\u4e00-\u9fff]`)가 포함되면 해당 언어로 우선 응답하고, `scraps`가 비어 있으면 Gemini 호출 없이 안내 응답을 즉시 반환하며, 입력은 질문 500자·스크랩 120건·아카이브 38,000자로 제한합니다.
5. **Anti-bot 인터스티셜 감지 & 엣지 캐싱 (`[src/index.js:isAntiBotInterstitial]`, `[wrangler.toml:CACHE_TTL_SECONDS]`)**
   - Cloudflare 챌린지(`Just a moment...`) 등 봇 차단 페이지가 감지되면 `502 Bad Gateway`를 반환합니다.
   - 성공한 스크래핑 응답은 Cloudflare Edge Cache에 기본 300초(`CACHE_TTL_SECONDS`) 동안 캐싱되며 `X-Proxy-Cache: HIT | MISS` 헤더를 포함합니다.

## 엔드포인트 (`[src/index.js:default.fetch]`)
- `GET /health`: 공개 상태 확인 (`{"status":"ok","service":"oh-my-scrap-proxy"}`)
- `GET /?url=<encoded_target_url>`: (인증 필요, `quest` 쿼리 파라미터 별칭 허용; `/health`·`/youtube-duration`·`/youtube-transcript` 외 모든 `GET` 경로가 HTML 프록시로 라우팅됨) 대상 URL의 HTML 텍스트 반환 (`text/plain; charset=utf-8`, `X-Proxy-Cache: HIT | MISS`)
- `GET /youtube-duration?videoId=<id>`: (인증 필요) YouTube 영상 길이(초) 반환 (`{ "seconds": number | null }`)
- `GET /youtube-transcript?videoId=<id>&lang=<ko|en|zh>`: (인증 필요) 자막 조회 결과 반환 (`{ transcript, language, isAutoGenerated, durationSeconds, reason? }`; 내부 예외 `catch` 시 HTTP `200`으로 `{ transcript: null, language: null, isAutoGenerated: false, detail }` 반환)
- `POST /analyze`: (인증 필요) `{ content, language, videoUrl, contentTypeHint, lowResVideo }` 분석 결과 반환 (`{ title, tags, contentType, fullSummary }`)
- `POST /ask`: (인증 필요) `{ question, language, scraps }` 기반 보관함 질의응답 반환 (`{ answer, matchedIds, followUpSuggestions }`)
- 허용되지 않은 HTTP 메서드는 `405 Method Not Allowed`를 반환합니다.

## 환경 변수 및 시크릿 (`[wrangler.toml:vars]`)
- `ALLOWED_ORIGINS`: 쉼표(`,`)로 구분된 허용 Origin 화이트리스트
- `FIREBASE_PROJECT_ID`: Firebase Auth ID 토큰의 `aud`/`iss` 검증에 사용하는 프로젝트 ID (기본 `"oh-my-scrap"`)
- `CACHE_TTL_SECONDS`: HTML 프록시 Edge Cache 유지 시간(초, 기본 `300`)
- `MAX_RESPONSE_BYTES`: 업스트림 HTML 최대 응답 크기(바이트, 기본 `2097152` = 2MB)
- Secrets (Worker Secrets 전용): `GEMINI_API_KEY`, `YOUTUBE_API_KEY`

## 로컬 실행 및 배포 방법

### 1. 로컬 시크릿 파일(`.dev.vars`) 및 의존성 준비
`workers/scrape-proxy/.dev.vars`(Git 무시 대상)에 개발용 시크릿을 작성합니다:
```env
GEMINI_API_KEY=...
YOUTUBE_API_KEY=...
```
```powershell
cd workers/scrape-proxy ; npm install ; npm run dev
```

### 2. 프로덕션 Worker Secrets 등록 및 배포
```powershell
cd workers/scrape-proxy ; npx wrangler secret put GEMINI_API_KEY ; npx wrangler secret put YOUTUBE_API_KEY ; npm run deploy
```
- 배포 URL: `https://oh-my-scrap-proxy.smilejk930.workers.dev`

### 3. 프론트엔드 환경 변수(`.env`) 연결
프로젝트 루트의 `.env` 파일에는 공개 Worker URL만 지정하며, `VITE_GEMINI_API_KEY`나 `VITE_YOUTUBE_API_KEY`는 포함하지 않습니다:
```env
VITE_SCRAPE_PROXY_URL=https://oh-my-scrap-proxy.smilejk930.workers.dev
```
