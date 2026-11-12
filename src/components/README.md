# Components (`src/components`)

## Overview
URL 스크랩의 추가, 재분석, 목록/카드 조회, 검색·날짜 필터링, 상세 보기 및 삭제를 담당하는 UI 다이얼로그와 보관함 뷰 컴포넌트들을 제공합니다.

## Interface
- `[AddScrapDialog.jsx:AddScrapDialog]` — URL 스크래핑, 선택적 AI 요약, Firestore 문서 생성을 오케스트레이션하는 기본 내보내기(default export) React 모달 컴포넌트(`{ onClose }`)입니다.
- `[ReAnalyzeDialog.jsx:ReAnalyzeDialog]` — 기존 스크랩 항목을 다시 스크래핑하고 재분석하는 기본 내보내기 React 모달 컴포넌트(`{ scrap, onClose }`)입니다.
- `[ScrapItem.jsx:ScrapItem]` — 개별 스크랩 행/카드를 렌더링하고 지연된 AI 분석, 재분석 모달 호출, 삭제 기능을 제공하는 기본 내보내기 React 컴포넌트(`{ scrap, mode, isDesktop, isSelected, onSelect, onDelete }`)입니다.
- `[ScrapList.jsx:ScrapList]` — Firestore의 사용자 스크랩 목록을 실시간 구독하고, 검색어 및 날짜 필터링과 반응형 리스트/카드 뷰(데스크톱 분할 상세 패널 포함)를 렌더링하는 기본 내보내기 React 컴포넌트(`{ viewMode, setViewMode, onAddClick }`)입니다.

## Invariants
- `[AddScrapDialog.jsx:handleSubmit]` — `[scraper.js:getForcedSiteTag]` 및 `[scraper.js:generateBasicTags]`를 사용합니다. `skipAi`가 `true`이면 `analyzeContent` 호출을 생략하고 `isYoutubeVideo` 여부에 따라 상태 문구(`"Long video detected. Skipping AI..."` vs `"Content restricted. Saving basic link info..."`)와 기본 태그(`generateBasicTags(url, isYoutubeVideo)`)를 설정합니다. `isYoutubeVideo`가 `true`이면 `analysis.tags`에 `"YouTube"` 태그가 항상 포함되도록 보장(맨 앞에 추가 후 최대 3개)합니다.
- `[AddScrapDialog.jsx:handleKeyDown]` — `!loading` 상태일 때만 `Escape` 키 입력으로 다이얼로그가 닫힙니다.
- `[ReAnalyzeDialog.jsx:handleAnalyze]` — `[scraper.js:getForcedSiteTag]` 및 `[scraper.js:generateBasicTags]`를 사용하며, `skipAi`가 `true`일 때 `[AddScrapDialog.jsx:handleSubmit]`과 동일하게 `isYoutubeVideo` 여부에 따라 상태 문구와 도메인 기본 태그를 분기합니다. `thumbnail && thumbnail !== "/placeholder.svg"`인 경우에만 Firestore 업데이트 페이로드에 `thumbnail`을 포함합니다.
- `[ReAnalyzeDialog.jsx:handleKeyDown]` — `!analyzing` 상태일 때만 `Escape` 키 입력으로 다이얼로그가 닫힙니다.
- `[ScrapItem.jsx:ScrapItem]` — 카드 모드(`mode === "card"`)에서는 비어 있지 않은 태그를 최대 3개(`slice(0, 3)`)까지만 표시하며, 지연된 AI 분석 버튼은 `!scrap.title`일 때만 렌더링합니다. `[ScrapItem.jsx:handleDelayedAnalysis]`는 `skipAi`가 `true`이면 `analyzeContent` 호출을 생략하고 `generateBasicTags(scrap.url, isYoutubeVideo)`를 적용하며, 새로고침(`RefreshCw`) 버튼 클릭 시 `isReAnalyzeOpen`을 `true`로 설정하여 `ReAnalyzeDialog`를 렌더링합니다.
- `[ScrapList.jsx:isDesktop]` — 데스크톱 분할 패널 레이아웃의 기준 너비는 `window.innerWidth >= 768`입니다.
- `[ScrapList.jsx:filteredScraps]` — `title`, `fullSummary`, `tags`에 대한 대소문자 무시 부분 문자열 일치 여부와 `filterDate` 열거값(`"all"`, `"today"`, `"week"`, `"month"`, `"older"` — `startOfDay(now)`, `subDays(now, 7)`, `subDays(now, 30)` 기준)으로 스크랩 목록을 필터링합니다.

## Side Effects
- `[AddScrapDialog.jsx:handlePaste]` — `navigator.clipboard.readText()`를 통해 시스템 클립보드 텍스트를 읽습니다.
- `[AddScrapDialog.jsx:handleSubmit]` — `scrapeUrl(url, { checkDuration: useAi })` 및 조건부 `analyzeContent(content, preferredLanguage, isYoutubeVideo ? url : null)`를 호출하고, `addDoc(collection(db, "scraps"), newScrap)`(`serverTimestamp()` 포함)으로 Firestore `scraps` 컬렉션에 문서를 생성한 뒤 1,500ms 타이머 후 `onClose()`를 호출합니다. 실패 시 `console.error` 및 `alert(error.message)`를 호출합니다.
- `[AddScrapDialog.jsx:AddScrapDialog]` — `updateUseAi` 및 `updateLanguage`를 통해 전역 인증 컨텍스트의 사용자 설정을 변경하며, `document`의 `keydown` 이벤트 리스너를 등록·해제합니다.
- `[ReAnalyzeDialog.jsx:handleAnalyze]` — `scrapeUrl(scrap.url, { checkDuration: localUseAi })` 및 조건부 `analyzeContent(content, localLang, isYoutubeVideo ? scrap.url : null)`를 호출하고, `updateDoc(doc(db, "scraps", scrap.id), updatePayload)`로 기존 Firestore 문서를 갱신한 뒤 1,000ms 대기 후 `onClose()`를 호출합니다. 실패 시 `console.error` 및 `alert(error.message)`를 호출합니다.
- `[ReAnalyzeDialog.jsx:ReAnalyzeDialog]` — `document`의 `keydown` 이벤트 리스너를 등록·해제합니다.
- `[ScrapItem.jsx:handleDelete]` — `window.confirm`으로 삭제 확인을 받은 뒤 `deleteDoc(doc(db, "scraps", scrap.id))`으로 Firestore 문서를 삭제하고 `onDelete(scrap.id)`를 호출합니다. 실패 시 `console.error` 및 `alert`를 호출합니다.
- `[ScrapItem.jsx:handleDelayedAnalysis]` — `scrapeUrl(scrap.url, { checkDuration: true })`과 조건부 `analyzeContent(content, preferredLanguage, isYoutubeVideo ? scrap.url : null)`를 호출하여 `updateDoc(doc(db, "scraps", scrap.id), ...)`으로 Firestore 문서를 갱신하며, 실패 시 `console.error` 및 `alert`를 호출합니다.
- `[ScrapItem.jsx:handleOpen]` — `window.open(scrap.url, "_blank")`을 통해 원본 URL을 새 브라우저 탭에서 엽니다.
- `[ScrapList.jsx:ScrapList]` — `onSnapshot`을 통해 `where("userId", "==", user.uid)` 및 `orderBy("createdAt", "desc")` 조건으로 Firestore `scraps` 컬렉션을 실시간 구독하고, `window`의 `resize` 이벤트 리스너를 등록·해제하며, 상세 패널의 썸네일 클릭 시 `window.open(selectedScrap.url, "_blank", "noopener,noreferrer")`로 원본 페이지를 엽니다.

## Verification
- Run: `npm run lint`
