# Source (`src`)

## Overview
React 애플리케이션 진입점(`main.jsx`), 최상위 인증·보관함 셸 및 PWA 공유 라우팅(`App.jsx`), 전역 스타일시트(`index.css`), 그리고 UI 컴포넌트·인증/스크랩 컨텍스트·Firebase 초기화·다국어(i18n)·스크래핑 및 AI 분석 서비스를 포함하는 루트 프론트엔드 소스 패키지입니다. (`App.css` 및 `assets/`의 `hero.png`·`react.svg`·`vite.svg`는 미사용 Vite 스캐폴드 파일입니다.)

## Interface
- `[App.jsx:App]` — `AuthProvider` 및 `ScrapProvider` 내부에 `MainApp`을 감싸는 기본 내보내기(default export) 루트 React 컴포넌트입니다.
- `[App.jsx:MainApp]` — 인증 게이트, 공유 URL 주입, `viewMode`/`selectedScrapId`/`isDialogOpen`/`isToolsOpen`/`deferredPrompt` 상태, 데스크톱 헤더 액션, 모바일 하단 고정 내비게이션(뷰 전환·상단 스크롤·추가 버튼), `ScrapList`·`AddScrapDialog`·`QuickToolsModal` 렌더링을 조율합니다.
- `[main.jsx:createRoot]` — `./index.css`를 로드하고 `/sw.js` Service Worker를 등록한 뒤 `#root` DOM 노드에 `<StrictMode>`로 감싼 `<App />`을 마운트하는 애플리케이션 부트스트랩 진입점입니다.
- [components](./components/README.md) — 스크랩 추가·재분석·Ask AI·퀵 도구 모달, 리스트/카드 뷰, 스마트 요약, 상세 편집 패널, 타임캡슐 배너를 제공합니다.
- [context](./context/README.md) — 인증 상태·사용자 설정 프로바이더(`AuthProvider`, `useAuth`) 및 스크랩 상태·중복 감지·변이 프로바이더(`ScrapProvider`, `useScraps`)입니다.
- [firebase](./firebase/README.md) — Firebase Auth, Google OAuth 프로바이더, Firestore 싱글턴 내보내기(`auth`, `googleProvider`, `db`)입니다.
- [i18n](./i18n/README.md) — `[i18n/translations.js]`(`SUPPORTED_LANGUAGES`, `LANGUAGE_OPTIONS`, `TRANSLATIONS`, `translate`, `normalizeLanguage`) 및 `[i18n/useTranslation.js]`(`useTranslation` → `{ language, setLanguage, t }`)를 제공합니다.
- [services](./services/README.md) — 클라이언트 측 URL 정규화·스크래핑 및 Gemini AI 분석·질의응답 서비스(`scrapeUrl`, `analyzeContent`, `askMyScraps`)입니다.

## Invariants
- `[App.jsx:MainApp]` — `!user` 상태일 때는 Google 로그인 랜딩 화면만 렌더링되며(대기 중인 공유 링크가 있을 경우 로그인 안내 배지 노출), 로그인되기 전까지 보관함 및 모달에는 접근할 수 없습니다.
- `[App.jsx:getInitialPendingShare]` — `/share-target` 또는 `?addUrl=`/`?url=`/`?text=`/`?title=` 파라미터에서 `extractFirstUrl`로 URL을 추출해 `sessionStorage`(`oms_pending_share_url`)에 보관하며(`/share-target` 경로 또는 `addUrl`/`url`/`text` 파라미터 유입 시 `cameFromUrlParams: true`), 로그인 직후 `AddScrapDialog`에 자동 주입합니다.
- `[App.jsx:MainApp]` — `viewMode` 상태는 `"list"`로 초기화되며 `"list"`와 `"card"` 사이에서 전환됩니다.
- `[App.jsx:UserAvatar]` — 아바타 레이블은 `user.displayName || user.email || "?"` 순서로 결정되며 첫 글자를 대문자로 표시합니다.
- `[App.jsx:handleScrollToTop]` — `prefers-reduced-motion` 미디어 쿼리를 확인해 `window`와 `mainContentRef.current` 스크롤을 최상단으로 이동합니다.

## Side Effects
- `[main.jsx:createRoot]` — `load` 이벤트에서 `navigator.serviceWorker.register('/sw.js')`를 호출하고 `document.getElementById('root')`에 React 트리를 마운트합니다.
- `[App.jsx:getInitialPendingShare]` / `[App.jsx:clearPendingShare]` — `sessionStorage`(`oms_pending_share_url`)를 읽고 쓰거나 제거합니다.
- `[App.jsx:MainApp]` — `window.history.replaceState`로 공유 쿼리 파라미터를 정리하고, `beforeinstallprompt`/`appinstalled` 이벤트를 수신하며(`[App.jsx:handleInstallPwa]`에서 `deferredPrompt.prompt()` 및 `userChoice` 실행), `[AuthContext.jsx:useAuth]`의 `login()`/`logout()`을 호출합니다(로그인 실패 시 `window.alert` 표시). 또한 비로그인 랜딩 화면에서 외부 배경 이미지(`lh3.googleusercontent.com`)를 로드하고, 모바일 상단 이동 시 `window.scrollTo`/`mainContentRef.current.scrollTo`를 호출합니다.

## Verification
- Run: `npm run lint`
