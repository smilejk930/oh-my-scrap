# Cloudflare Workers Scrape & AI Proxy (`workers/scrape-proxy`)

## Overview
`oh-my-scrap` 프론트엔드의 URL 스크래핑, YouTube 영상 길이 조회, Gemini AI 분석을 안전하게 대행하는 전용 Cloudflare Workers 엣지 백엔드 프록시 서버입니다. 유료 API 키(`GEMINI_API_KEY`, `YOUTUBE_API_KEY`)를 클라이언트 번들에서 완전히 분리하여 Worker Secrets로 보관하며, 엄격한 Origin 화이트리스트, Firebase Auth ID 토큰 검증, SSRF 방어 및 안전한 응답 헤더를 적용합니다.

## 주요 기능
1. **보안 (엄격한 Origin 검증 · Firebase Auth JWT 검증 · SSRF 방어)**
   - `/health` 및 `OPTIONS`를 제외한 모든 요청은 `ALLOWED_ORIGINS`에 등록된 `Origin` 헤더가 있어야 하며(`403`), `Authorization: Bearer <Firebase ID Token>` 헤더의 RS256 서명 및 클레임(`aud`, `iss`, `sub`, `exp`, `iat`)을 Google 공개 JWK로 검증합니다(`401`).
   - `localhost`, 사설 IP 대역(`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), 클라우드 메타데이터(`169.254.169.254`, `metadata.google.internal`), DNS 리바인딩 도메인(`.nip.io`, `.sslip.io`, `.xip.io`), 정수/8진수/16진수 IP 우회 표기, IPv4-mapped IPv6 접근을 차단하며 리다이렉트(최대 5홉) 시 매 홉마다 대상 호스트를 재검증합니다.
   - 스크래핑 응답은 `Content-Type: text/plain; charset=utf-8`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` 헤더로 반환해 프록시 도메인 내 XSS 실행을 차단합니다.
2. **브라우저 헤더 스푸핑 & 한글 인코딩 변환**
   - 최신 데스크톱 Chrome 브라우저 `User-Agent`, `Accept-Language: ko-KR` 등의 헤더를 주입해 단순 봇 차단을 우회합니다.
   - `Content-Type` 헤더나 `<meta charset>`에 `euc-kr` / `cp949`가 지정된 구형 한국어 웹페이지를 자동으로 감지해 UTF-8로 변환합니다.
3. **사이트별 맞춤 추출**
   - **Notion 공개 페이지 (`*.notion.site`)**: `loadPageChunk` API를 호출해 실제 페이지 제목과 본문 텍스트 블록을 추출하고 정적 HTML을 합성해 반환합니다.
   - **Reddit 게시글 (`*.reddit.com/r/.../comments/...`)**: Reddit JSON 엔드포인트(`.json`)에서 본문과 상위 댓글을 추출해 정적 HTML로 합성합니다.
4. **API 키 격리 엔드포인트 (`GEMINI_API_KEY`, `YOUTUBE_API_KEY`)**
   - **`GET /youtube-duration?videoId=<id>`**: 서버 시크릿 `YOUTUBE_API_KEY`로 YouTube Data API v3 영상 길이를 조회해 `{ seconds }`를 반환합니다.
   - **`POST /analyze`**: 서버 시크릿 `GEMINI_API_KEY`와 `systemInstruction` + `<document>` 경계 분리를 통해 간접 프롬프트 인젝션을 방어하며 Gemini REST API 다중 모델 폴백 분석을 수행합니다.
5. **Anti-bot 인터스티셜 감지 & 엣지 캐싱**
   - Cloudflare 챌린지(`Just a moment...`) 등 봇 차단 페이지가 감지되면 `502 Bad Gateway`를 반환합니다.
   - 성공한 스크래핑 응답은 Cloudflare Edge Cache에 기본 300초(`CACHE_TTL_SECONDS`) 동안 캐싱됩니다.

## 엔드포인트
- `GET /health`: 공개 상태 확인 (`{"status":"ok","service":"oh-my-scrap-proxy"}`)
- `GET /?url=<encoded_target_url>`: (인증 필요) 대상 URL의 HTML 텍스트 반환 (`text/plain; charset=utf-8`)
- `GET /youtube-duration?videoId=<id>`: (인증 필요) YouTube 영상 길이(초) 반환 (`{ "seconds": number | null }`)
- `POST /analyze`: (인증 필요) `{ content, language, videoUrl }` 분석 결과 반환 (`{ title, tags, fullSummary }`)

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
- 배포 URL: `https://oh-my-scrap-proxy.oh-my-scrap-proxy.workers.dev`

### 3. 프론트엔드 환경 변수(`.env`) 연결
프로젝트 루트의 `.env` 파일에는 공개 Worker URL만 지정하며, `VITE_GEMINI_API_KEY`나 `VITE_YOUTUBE_API_KEY`는 포함하지 않습니다:
```env
VITE_SCRAPE_PROXY_URL=https://oh-my-scrap-proxy.oh-my-scrap-proxy.workers.dev
```
