# Cloudflare Workers Scrape Proxy (`workers/scrape-proxy`)

## Overview
`oh-my-scrap` 프론트엔드의 URL 스크래핑 성공률과 응답 속도를 높이기 위한 전용 Cloudflare Workers 엣지 프록시 서버입니다. 공용 CORS 프록시(`CodeTabs`, `AllOrigins`)의 속도 저하·IP 차단·인코딩 깨짐 문제를 해결하며, 오픈 프록시 악용 방지(Origin 검증) 및 SSRF 방어 로직을 내장하고 있습니다.

## 주요 기능
1. **보안 (Origin 화이트리스트 & SSRF 방어)**
   - `ALLOWED_ORIGINS`에 등록된 도메인(`https://oh-my-scrap.web.app`, `http://localhost:5173` 등)에서 보낸 요청만 허용합니다.
   - `localhost`, 사설 IP 대역(`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), 클라우드 메타데이터(`169.254.169.254`, `metadata.google.internal`)로의 접근을 차단하며, 리다이렉트(최대 5홉) 발생 시 매 홉마다 대상 호스트를 재검증합니다.
2. **브라우저 헤더 스푸핑 & 한글 인코딩 변환**
   - 최신 데스크톱 Chrome 브라우저 `User-Agent`, `Accept-Language: ko-KR` 등의 헤더를 주입해 단순 봇 차단을 우회합니다.
   - `Content-Type` 헤더나 `<meta charset>`에 `euc-kr` / `cp949`가 지정된 구형 한국어 웹페이지를 자동으로 감지해 UTF-8로 변환합니다.
3. **사이트별 맞춤 추출**
   - **Notion 공개 페이지 (`*.notion.site`)**: 클라이언트 렌더링 전용인 Notion 페이지의 경우 `loadPageChunk` API를 호출해 실제 페이지 제목과 본문 텍스트 블록을 추출하고 시맨틱 HTML(`<article>`, `<meta property="og:title">`)로 합성하여 반환합니다.
   - **Reddit 게시글 (`*.reddit.com/r/.../comments/...`)**: Reddit JSON 엔드포인트(`.json`)에서 본문과 상위 댓글을 추출하여 정적 HTML로 합성합니다.
4. **Anti-bot 인터스티셜 감지 & 엣지 캐싱**
   - Cloudflare 챌린지(`Just a moment...`) 등 봇 차단 페이지가 감지되면 `200 OK` 대신 `502 Bad Gateway`를 반환하여 클라이언트가 즉시 다음 폴백 단계로 넘어갈 수 있게 합니다.
   - 성공한 HTML 응답은 Cloudflare Edge Cache에 기본 300초(`CACHE_TTL_SECONDS`) 동안 캐싱됩니다.

## 엔드포인트
- `GET /?url=<encoded_target_url>`: 대상 URL의 HTML을 추출하여 반환 (`text/html; charset=utf-8`)
- `GET /health`: 프록시 상태 확인 (`{"status":"ok","service":"oh-my-scrap-proxy"}`)

## 로컬 실행 및 배포 방법

### 1. 의존성 설치 및 로컬 개발 서버 실행
```powershell
cd workers/scrape-proxy ; npm install ; npm run dev
```
- 로컬에서 기본적으로 `http://localhost:8787`에서 실행됩니다.

### 2. Cloudflare 계정 로그인 및 배포
```powershell
cd workers/scrape-proxy ; npx wrangler login ; npm run deploy
```
- 배포 URL: `https://oh-my-scrap-proxy.oh-my-scrap-proxy.workers.dev`

### 3. 프론트엔드 환경 변수(`.env`) 연결
프로젝트 루트의 `.env` 파일에 발급받은 Worker URL이 설정되어 있습니다(미설정 시 기본값으로 동일 URL 사용):
```env
VITE_SCRAPE_PROXY_URL=https://oh-my-scrap-proxy.oh-my-scrap-proxy.workers.dev
```
- [scraper.js](../../src/services/scraper.js)의 2단계 HTML 추출에서 외부 서드파티 프록시 없이 이 Cloudflare Worker를 단독으로 호출합니다.
