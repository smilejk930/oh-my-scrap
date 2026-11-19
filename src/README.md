# Source (`src`)

## Overview
React 애플리케이션 진입점(`main.jsx`), 최상위 인증·보관함 셸 및 PWA 공유 라우팅(`App.jsx`), 그리고 UI 컴포넌트·인증/스크랩 컨텍스트·Firebase 초기화·스크래핑 및 AI 분석 서비스를 포함하는 루트 프론트엔드 소스 패키지입니다.

## Interface
- `[App.jsx:App]` — `AuthProvider` 및 `ScrapProvider` 내부에 `MainApp`을 감싸는 기본 내보내기(default export) 루트 React 컴포넌트입니다.
- `[main.jsx:createRoot]` — `/sw.js` Service Worker를 등록하고 `#root` DOM 노드에 `<StrictMode>`로 감싼 `<App />`을 마운트하는 애플리케이션 부트스트랩 진입점입니다.
- [components](./components/README.md) — 스크랩 추가·재분석·Ask AI·퀵 도구 모달, 리스트/카드 뷰, 스마트 요약, 상세 편집 패널, 타임캡슐 배너를 제공합니다.
- [context](./context/README.md) — 인증 상태·사용자 설정 프로바이더(`AuthProvider`, `useAuth`) 및 스크랩 상태·중복 감지·변이 프로바이더(`ScrapProvider`, `useScraps`)입니다.
- [firebase](./firebase/README.md) — Firebase Auth, Google OAuth 프로바이더, Firestore 싱글턴 내보내기(`auth`, `googleProvider`, `db`)입니다.
- [services](./services/README.md) — 클라이언트 측 URL 정규화·스크래핑 및 Gemini AI 분석·질의응답 서비스(`scrapeUrl`, `analyzeContent`, `askMyScraps`)입니다.

## Invariants
- `[App.jsx:MainApp]` — `!user` 상태일 때는 Google 로그인 랜딩 화면만 렌더링되며(대기 중인 공유 링크가 있을 경우 로그인 안내 배지 노출), 로그인되기 전까지 보관함 및 모달에는 접근할 수 없습니다.
- `[App.jsx:getInitialPendingShare]` — `/share-target` 또는 `?addUrl=`/`?url=`/`?text=` 파라미터로 유입된 URL을 `extractFirstUrl`로 추출해 `sessionStorage`에 보관하며, 로그인 직후 `AddScrapDialog`에 자동 주입합니다.
- `[App.jsx:MainApp]` — `viewMode` 상태는 `"list"`로 초기화되며 `"list"`와 `"card"` 사이에서 전환됩니다.
- `[App.jsx:UserAvatar]` — 아바타 레이블은 `user.displayName || user.email || "?"` 순서로 결정되며 첫 글자를 대문자로 표시합니다.

## Side Effects
- `[main.jsx:createRoot]` — `load` 이벤트에서 `navigator.serviceWorker.register('/sw.js')`를 호출하고 `document.getElementById('root')`에 React 트리를 마운트합니다.
- `[App.jsx:MainApp]` — `window.history.replaceState`로 공유 쿼리 파라미터를 정리하고, `beforeinstallprompt`/`appinstalled` 이벤트를 수신하며, `[AuthContext.jsx:useAuth]`의 `login()`/`logout()`을 호출합니다.

## Verification
- Run: `npm run lint`
