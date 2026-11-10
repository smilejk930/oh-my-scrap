# Oh My Scrap Blueprint
> **Design your Knowledge.** 🚀

---

[English](#-english) | [한국어](#-한국어) | [아키텍처 및 EGM 계약](#-system-overview)

---

## 🌎 English

### What is Oh My Scrap?
Oh My Scrap is an **AI-powered personal archiving tool** designed to help you capture and organize digital knowledge effortlessly. Instead of just saving links, **Oh My Scrap** analyzes them for you.

### ✨ Core Features

#### 1. Secure & Instant Google Login
- No more forgotten passwords. Sign in securely using your **Google account**.
- Your personal archive is synced and accessible from any device.

#### 2. Smart One-Click Scraping
- Simply paste a URL and hit send.
- The system automatically extracts the **Title**, **Description**, and **Preview Image**, providing a beautiful visual card for every link.

#### 3. AI-Powered Analysis (Gemini)
- **AI Toggle (ON/OFF)**: You can choose whether to use AI for every scrap. Turn it OFF for quick link saving, or keep it ON for deep analysis.
- **Multilingual Support**: Choose your preferred language (**Korean/English**) for AI summaries and insights.
- **Automatic Summarization**: Powered by Google’s Gemini AI, the app provides a concise summary and extracts relevant tags.

#### 4. YouTube Video Understanding
- **Multimodal Video Analysis**: AI directly "watches" and analyzes the YouTube video stream alongside oEmbed metadata via Gemini's multimodal video understanding.
- **Smart Quota Management**: For videos longer than **3 minutes**, the system automatically skips AI analysis to save resources while still saving essential metadata.

#### 5. Personal Knowledge Archive
- **Flexible View Modes**: Switch between **List View** and **Card View** to browse your archive your way.
- Manage your saved content in a clean, organized "Storage" (내 보관함).
- View full details, access original links, or delete items you no longer need.

#### 6. Premium Responsive Design
- Optimized for both **Desktop** and **Mobile**.
- Experience smooth animations and a "Glassmorphism" UI that makes organizing your knowledge a delight.

---

## 🇰🇷 한국어

### Oh My Scrap이란?
Oh My Scrap은 웹상의 수많은 정보들을 단순히 저장하는 것을 넘어, **AI가 내용을 분석하여 당신만의 지식 자산으로 만들어주는 아카이빙 도구**입니다.

### ✨ 주요 기능 설명

#### 1. 간편하고 안전한 구글 로그인
- 복잡한 가입 절차 없이 **구글 계정**으로 즉시 시작하세요.
- 당신의 스크랩 데이터는 안전하게 보호되며, 로그인만 하면 어디서든 접근할 수 있습니다.

#### 2. 스마트 원클릭 스크래핑
- 저장하고 싶은 URL을 붙여넣기만 하세요.
- 시스템이 자동으로 해당 페이지의 **제목, 설명, 이미지**를 추출하여 보기 좋은 카드 형태로 저장해 줍니다.

#### 3. AI 기반 내용 분석 및 요약 (Gemini)
- **AI 분석 ON/OFF 토글**: URL 등록 시 AI 분석 사용 여부를 선택할 수 있습니다. 단순 링크 저장이 필요할 땐 OFF, 깊이 있는 분석이 필요할 땐 AI 기능을 활용하세요.
- **다국어 요약 지원**: 요약 결과 언어를 **한국어 또는 영어**로 자유롭게 설정할 수 있습니다.
- **자동 핵심 요약**: Google Gemini AI가 스크랩한 페이지의 내용을 직접 읽고 핵심 내용을 분석하여 태그와 함께 제공합니다.

#### 4. YouTube 영상 분석 최적화
- **멀티모달 영상 분석**: Gemini의 비디오 이해 기능을 통해 YouTube 영상 자체와 메타데이터를 직접 분석하여 핵심 내용을 요약해 줍니다.
- **스마트 분석 생략**: **3분 초과 영상**의 경우, 효율적인 리소스 관리를 위해 AI 분석을 자동으로 생략하고 기본 메타데이터만 저장합니다.

#### 5. 나만의 지식 보관함
- **다양한 보기 모드**: **리스트형**과 **카드형** 뷰 모드를 지원하여 취향에 맞게 보관함을 관리할 수 있습니다.
- 스크랩한 콘텐츠들을 '내 보관함'에서 한눈에 관리하세요.
- 상세 내용을 확인하고, 원본 링크로 이동하거나, 더 이상 필요 없는 항목은 간편하게 삭제할 수 있습니다.

#### 6. 뛰어난 사용자 경험 (UX/UI)
- **데스크탑과 모바일** 어디서든 최적화된 레이아웃을 제공합니다.
- 부드러운 애니메이션과 세련된 디자인으로 지식을 정리하는 과정이 즐거워집니다.

---

## 🛠 Tech Stack
- **Frontend**: React, Vite, Framer Motion
- **Backend/DB**: Firebase (Auth, Firestore)
- **AI Service**: Google Gemini AI (Multimodal support)
- **Icons**: Lucide-react

---

## System Overview
Oh My Scrap은 Firebase Authentication(Google OAuth), Cloud Firestore(`asia-northeast3`), 그리고 Google Generative AI SDK(`@google/generative-ai`)를 기반으로 동작하는 React 19 + Vite 단일 페이지 애플리케이션(SPA)입니다. 인증된 사용자가 모달 다이얼로그(`AddScrapDialog`, `ReAnalyzeDialog`)를 통해 웹페이지 또는 YouTube URL을 제출하면, 클라이언트 측 스크래핑 파이프라인(`scraper.js`)이 CORS 프록시 폴백 또는 YouTube oEmbed / Data API v3를 이용해 메타데이터와 본문 텍스트를 추출하고, 설정에 따라 Gemini(`gemini.js`)로 본문이나 영상을 요약한 뒤 Firestore `scraps` 컬렉션에 저장하며, 사용자별 설정(`language`, `useAi`)은 `users/{uid}` 문서를 통해 실시간으로 동기화합니다.

## Local Interface & Invariants
- `[vite.config.js:default]` — `defineConfig({ plugins: [react()] })`를 사용하는 Vite 번들러 설정입니다.
- `[eslint.config.js:default]` — `dist`를 제외하고 `**/*.{js,jsx}`를 대상으로 `@eslint/js` recommended, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` 규칙을 적용하는 ESLint Flat Config입니다(`no-unused-vars`는 `^[A-Z_]` 패턴을 제외한 미사용 변수를 에러로 처리).
- `[firestore.rules:cloud.firestore]` — `/databases/{database}/documents/scraps/{scrapId}` 및 `/databases/{database}/documents/users/{userId}`에 대한 Firestore v2 보안 규칙입니다:
  - `/scraps/{scrapId}` 읽기/쓰기는 `request.auth != null && request.auth.uid == resource.data.userId`를 요구하며, 문서 생성(`create`)은 `request.auth != null && request.resource.data.userId == request.auth.uid`를 요구합니다.
  - `/users/{userId}` 읽기/쓰기는 `request.auth != null && request.auth.uid == userId`를 요구합니다.
- `[firebase.json:firestore]` — `asia-northeast3` 리전의 `(default)` Firestore 데이터베이스에 `firestore.rules`와 `firestore.indexes.json`을 연결합니다.
- `[firebase.json:hosting]` — `dist` 정적 빌드 결과물을 서빙하며, 모든 경로를 `/index.html`로 연결하는 SPA 리라이트(`** -> /index.html`)와 `/index.html`(`no-cache, no-store, must-revalidate`) 및 `/assets/**`(`public, max-age=31536000, immutable`) 캐시 헤더를 설정합니다.

## Subdirectories & System Boundaries
- `src`: [./src/README.md](./src/README.md) — 루트 React 애플리케이션 패키지(`main.jsx`, `App.jsx`)이자 모든 클라이언트 기능 모듈의 상위 경계입니다.
  - `src/components`: [./src/components/README.md](./src/components/README.md) — 스크랩 추가·재분석 다이얼로그 및 보관함 뷰(`AddScrapDialog`, `ReAnalyzeDialog`, `ScrapItem`, `ScrapList`)를 제공합니다.
  - `src/context`: [./src/context/README.md](./src/context/README.md) — Firebase Auth 상태 및 Firestore 사용자 설정 실시간 동기화 컨텍스트(`AuthProvider`, `useAuth`)를 제공합니다.
  - `src/firebase`: [./src/firebase/README.md](./src/firebase/README.md) — Firebase 앱 초기화 및 싱글턴 핸들(`auth`, `googleProvider`, `db`)을 내보냅니다.
  - `src/services`: [./src/services/README.md](./src/services/README.md) — URL 메타데이터·본문 스크래퍼(`scrapeUrl`)와 Gemini 멀티모달 콘텐츠 분석기(`analyzeContent`)를 제공합니다.

## Global Invariants
- **사용자 데이터 격리 (Tenant Isolation)**: Firestore `scraps` 컬렉션의 모든 문서는 `userId == request.auth.uid`를 통해 소유자별로 격리되며(`[ScrapList.jsx:ScrapList]`의 클라이언트 쿼리 및 `[firestore.rules:/scraps/{scrapId}]` 서버 규칙으로 이중 강제), `users/{userId}` 문서 역시 `request.auth.uid == userId`로 제한됩니다.
- **인증 기반 UI 게이트**: `[App.jsx:MainApp]`은 `!user` 상태에서 Google 로그인 랜딩 화면만 렌더링하여 비인증 사용자의 `ScrapList` 및 `AddScrapDialog` 접근을 차단하며, `[AuthContext.jsx:AuthProvider]`는 초기 인증 상태 확인이 완료(`!loading`)되기 전까지 하위 트리를 렌더링하지 않습니다.
- **AI 우회 및 쿼터 보호 규칙**:
  - `useAi`가 `false`일 때 `[AddScrapDialog.jsx:handleSubmit]` 및 `[ReAnalyzeDialog.jsx:handleAnalyze]`는 `analyzeContent` 호출과 YouTube 재생시간 조회(`checkDuration: false`)를 모두 건너뜁니다.
  - YouTube 영상 길이가 `YOUTUBE_AI_MAX_SECONDS`(`180`초)를 초과하면 `[scraper.js:scrapeUrl]`에서 `skipAi = true`를 반환하여 `analyzeContent`를 생략하고 기본 태그 `["YouTube", "Video"]`를 저장합니다.
  - `[gemini.js:analyzeContent]`에 전달되는 웹페이지 텍스트는 최대 5,000자로 제한되며, YouTube URL은 Gemini API 호출 전 `https://www.youtube.com/watch?v=${id}` 형식으로 정규화됩니다.
- **태그 개수 제한 및 도메인 강제 규칙**: 스크랩 카드 렌더링 및 다이얼로그 저장 시 태그는 최대 3개(`slice(0, 3)`)로 제한되며, `news.hada.io` URL에는 `"GeekNews"` 태그(`FORCED_SITE_TAGS`)가, YouTube 영상에는 `"YouTube"` 태그가 항상 보장됩니다.

## Global Side Effects
- **Firebase Authentication & Cloud Firestore**: 실시간 `onSnapshot` 리스너, `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`을 통해 `users/{uid}` 및 `scraps/{scrapId}` 문서를 읽고 쓰며, `signInWithPopup`으로 Google OAuth 팝업 로그인을 수행합니다.
- **외부 네트워크 호출**:
  - `VITE_GEMINI_API_KEY`를 사용하여 `@google/generative-ai`(`model.generateContent`)로 Google Generative AI API를 호출합니다.
  - HTML 스크래핑을 위해 공개 CORS 프록시(`https://api.codetabs.com/v1/proxy`, `https://corsproxy.io/`, `https://api.allorigins.win/get`)를 순차 호출합니다.
  - 영상 메타데이터 및 재생시간 확인을 위해 YouTube oEmbed(`https://www.youtube.com/oembed`)와 YouTube Data API v3(`https://www.googleapis.com/youtube/v3/videos`, `VITE_YOUTUBE_API_KEY` 사용)를 호출합니다.
- **브라우저 환경 상호작용**: `navigator.clipboard.readText()`로 시스템 클립보드를 읽고, `window.open`으로 외부 링크를 열며, DOM 이벤트 리스너(`keydown`, `resize`)를 등록·해제합니다.

## System Verification
- Run: `npm run lint`
- Build check: `npm run build`

---

### Created by smilejk930
*Created with focus on visual excellence and AI productivity.*
