# Source (`src`)

## Overview
React 애플리케이션 진입점(`main.jsx`), 최상위 인증 셸(`App.jsx`), 그리고 UI 컴포넌트·인증 컨텍스트·Firebase 초기화·스크래핑 및 AI 분석 서비스를 포함하는 루트 프론트엔드 소스 패키지입니다.

## Interface
- `[App.jsx:App]` — `AuthProvider` 내부에 `MainApp`을 감싸는 기본 내보내기(default export) 루트 React 컴포넌트입니다.
- `[main.jsx:createRoot]` — `#root` DOM 노드에 `<StrictMode>`로 감싼 `<App />`을 마운트하는 애플리케이션 부트스트랩 진입점입니다.
- [components](./components/README.md) — 스크랩 추가·재분석 다이얼로그 및 리스트/카드 보관함 뷰(`AddScrapDialog`, `ReAnalyzeDialog`, `ScrapItem`, `ScrapList`)입니다.
- [context](./context/README.md) — 인증 상태 및 사용자 설정 프로바이더(`AuthProvider`, `useAuth`)입니다.
- [firebase](./firebase/README.md) — Firebase Auth, Google OAuth 프로바이더, Firestore 싱글턴 내보내기(`auth`, `googleProvider`, `db`)입니다.
- [services](./services/README.md) — 클라이언트 측 URL 스크래핑 및 Gemini AI 본문/영상 분석 서비스(`scrapeUrl`, `analyzeContent`)입니다.

## Invariants
- `[App.jsx:MainApp]` — `!user` 상태일 때는 Google 로그인 랜딩 화면만 렌더링되며, 로그인되기 전까지 `ScrapList`, 내비게이션 컨트롤, `AddScrapDialog`에는 접근할 수 없습니다.
- `[App.jsx:MainApp]` — `viewMode` 상태는 `"list"`로 초기화되며 `"list"`와 `"card"` 사이에서 전환됩니다.
- `[App.jsx:MainApp]` — `AddScrapDialog`는 열릴 때마다 내부 상태가 초기화되도록 `isDialogOpen`이 `true`일 때만 `AnimatePresence` 내부에 조건부 렌더링됩니다.
- `[App.jsx:UserAvatar]` — 아바타 레이블은 `user.displayName || user.email || "?"` 순서로 결정되며 첫 글자를 대문자로 표시합니다.

## Side Effects
- `[main.jsx:createRoot]` — 모듈 실행 시점에 `document.getElementById('root')`를 조회하여 React `StrictMode` `<App />` 트리를 DOM에 마운트합니다.
- `[App.jsx:MainApp]` — `[AuthContext.jsx:useAuth]`의 `login()` 및 `logout()`을 호출하며, `login()` 실패 시 `console.error`로 로그를 남기고 브라우저 `alert()`를 표시합니다.

## Verification
- Run: `npm run lint`
