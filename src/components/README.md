# Components (`src/components`)

## Overview
URL 스크랩의 추가(중복 감지·클립보드 제안 포함), 재분석, 리스트/카드 조회, 태그·상태·날짜 필터링, 도메인별 스마트 요약 렌더링, 인라인 편집·개인 메모, Ask AI 보관함 질의응답, 타임캡슐 재발견 배너, PWA/북마클릿/UID 퀵 도구 모달을 제공합니다.

## Interface
- `[AddScrapDialog.jsx:AddScrapDialog]` — URL 스크래핑, 실시간 중복 URL 감지, 클립보드 URL 제안, AI/비-AI 요약, Firestore 문서 생성을 오케스트레이션하는 모달 컴포넌트(`{ onClose, initialUrl, onViewExisting }`)입니다. `localLang` 상태는 전역 `preferredLanguage`로 초기화되어 해당 스크랩의 AI 분석 언어만 개별 재정의하며, AI 토글은 `updateUseAi`로 전역 `useAi` 설정을 즉시 변경합니다. 중복 배너에서는 내장 `<ReAnalyzeDialog />`를 직접 열어 기존 항목을 재분석할 수 있습니다.
- `[ReAnalyzeDialog.jsx:ReAnalyzeDialog]` — 기존 스크랩 항목을 다시 스크래핑(YouTube 자막 폴백 포함)하고 재분석하는 모달 컴포넌트(`{ scrap, onClose, onSuccess }`)입니다. `localUseAi`·`localLang`은 전역 설정에서 초기화된 로컬 상태로만 동작하며, `db`에 직접 `updateDoc`을 호출해 `title`·`tags`·`contentType`·`fullSummary`(및 `/placeholder.svg`가 아닌 `thumbnail`)만 갱신합니다(`originalTitle` 미수정).
- `[ScrapItem.jsx:ScrapItem]` — 개별 스크랩 행/카드를 렌더링하고 핀 상태 배지, 클릭형 태그(카드 뷰 최대 3개·분할 슬림 행 최대 2개), 데스크톱 분할 시 슬림 행(`isCompactSplit`: 54px 썸네일·2줄 클램프·호버 액션 필), 모바일 확장 상세(스마트 요약·개인 메모·인라인 편집), 모바일 카드 클릭 시 원문 바로 열기(`openSafeUrl`), `<ReAnalyzeDialog />` 모달(`isReAnalyzeOpen`), 그리고 `!scrap.title` 미분석 항목의 지연 AI 분석(`[ScrapItem.jsx:handleDelayedAnalysis]`)을 제공하는 컴포넌트입니다.
- `[ScrapList.jsx:ScrapList]` — `ScrapContext` 데이터를 기반으로 통합 데스크톱 상단 바·검색·필터·태그 클라우드, 독립 스크롤 2단 분할 레이아웃, 드래그·키보드(`←`/`→`/`Home`)·더블클릭 초기화 지원 너비 조절 스플리터(`oms_desktop_list_width`), 키보드 탐색(`↑`/`↓`/`Esc`), 타임캡슐 배너(`isDefaultView` 조건부 노출), Ask AI 모달, 모바일 펼침 스크롤 보정을 조율합니다.
- `[ScrapDetailPane.jsx:ScrapDetailPane]` — 데스크톱 우측 상세 패널로 이전/다음 이동, 툴바 미니 제목, 집중 읽기(`isExpanded`) 토글, 컴팩트 16:9 가로형 헤더와 통합 스크롤 본문(`SmartSummaryView`·개인 메모·인라인 편집), 재분석·원문 보기·삭제를 제공합니다.
- `[SmartSummaryView.jsx:SmartSummaryView]` — `contentType`(`recipe`, `tech`, `video`, `place`, `product`, `general`) 및 `[섹션]` 구조를 파싱해(`contentType` 누락·`"general"` 시 `[SmartSummaryView.jsx:inferContentTypeFromSummary]`로 섹션 헤더 기반 타입 추론) 레시피 체크리스트(Firestore `checkedItems` 동기화)와 `[MM:SS]`/`[H:MM:SS]` YouTube 타임스탬프 필(YouTube URL은 클릭 시 해당 시점 이동, 그 외는 정적 배지)을 렌더링합니다.
- `[AskArchiveModal.jsx:AskArchiveModal]` — 보관함 전체에 자연어 질문을 던지고 답변·출처 스크랩 카드·후속 질문을 표시하는 AI Q&A 모달(`{ onClose, onSelectScrap, initialQuestion }`)입니다.
- `[RediscoverBanner.jsx:RediscoverBanner]` — 1주(6~8일)/1개월(28~32일)/3개월(85~95일)/1년(360~370일) 전 타임캡슐 또는 날짜 해시 기반 결정적 추천 스크랩을 표시하고 순차 셔플(`offset`) 및 일일 닫기를 지원하는 배너(`{ scraps, onSelectScrap }`)입니다.
- `[QuickToolsModal.jsx:QuickToolsModal]` — 언어 설정(English/日本語/한국어/中文, 앱 UI 및 AI 기본 언어 연동), PWA 설치/모바일 Share Sheet 안내, 드래그·복사용 데스크톱 북마클릿, 개인 UID 복사 UI를 제공하는 모달(`{ onClose, deferredPrompt, onInstallPwa }`)입니다.

## Invariants
- `[AddScrapDialog.jsx:AddScrapDialog]` — `duplicateScrap`이 감지되면 `allowDuplicate`를 명시적으로 허용하기 전까지 중복 제출을 차단하고 기존 항목 보기·재분석(`<ReAnalyzeDialog />`)·무시 저장 선택지를 제공합니다. 저장 완료 후 1,400ms 동안 프리뷰 카드를 표시한 뒤 `onClose()`를 호출합니다.
- `[AddScrapDialog.jsx:handleSubmit]` / `[ReAnalyzeDialog.jsx:handleAnalyze]` / `[ScrapItem.jsx:handleDelayedAnalysis]` — `[scraper.js:applyRequiredTags]`를 통해 강제 사이트 태그 및 `"YouTube"` 태그를 보장하며 최대 3개 태그와 `contentType`을 저장합니다. `[ScrapItem.jsx:handleDelayedAnalysis]`는 `!scrap.title`인 미분석 항목에 대해 전역 `useAi`와 무관하게 `checkDuration: true`로 AI 분석을 수행하고 `isRead: false`, `isPinned: false`와 함께 `updateScrap`으로 갱신합니다.
- `[ScrapList.jsx:filteredScraps]` — 검색어(`title`, `fullSummary`, `userNote`, `tags`), 태그, 상태(`pinned`), 날짜(`all`/`today`/`week`/`month`/`older`) 필터를 모두 적용한 뒤 `isPinned` 항목을 최상단에 우선 정렬합니다.
- `[ScrapList.jsx:ScrapList]` — 데스크톱(`>= 769px`)에서 100dvh 독립 2단 스크롤 셸을 유지하고, 집중 읽기 모드 전환 시 좌측 목록을 언마운트하지 않고 숨겨 목록 스크롤 위치를 보존합니다. `Esc`는 집중 모드 복귀 → 상세 닫기 순으로 동작합니다.
- `[ScrapDetailPane.jsx:ScrapDetailPane]` — `key={selectedScrap.id}`로 마운트되어 선택 항목 변경 시 로컬 편집 상태 및 스크롤 위치를 안전하게 초기화합니다.
- `[RediscoverBanner.jsx:RediscoverBanner]` — `scraps.length < 3`이면 렌더링하지 않으며, `ScrapList`에서 필터·검색이 비어 있는 `isDefaultView`일 때만 노출됩니다. 추천 항목은 `hashString(todayKey) % candidates.length`와 순차 `offset`으로 결정적으로 선택됩니다.
- `[QuickToolsModal.jsx:QuickToolsModal]` — JSX 내 `javascript:` URL 경고를 피하기 위해 북마클릿 `href`를 `useEffect`에서 DOM ref에 직접 설정합니다.

## Side Effects
- `[AddScrapDialog.jsx]` — `navigator.permissions`/`navigator.clipboard.readText()`, `document` `paste`/`keydown` 리스너, `updateUseAi`, `scrapeUrl`, `analyzeContent`, `addDoc(collection(db, "scraps"), ...)`, 1,400ms 닫기 타이머, `window.alert`를 호출합니다.
- `[ReAnalyzeDialog.jsx]` — `document` `keydown`(`Escape`) 리스너, `scrapeUrl`, `analyzeContent`, Firestore `updateDoc(doc(db, "scraps", scrap.id), ...)` 직접 호출, `window.alert`를 수행합니다.
- `[ScrapDetailPane.jsx]` — `ScrapContext`의 `updateScrap`, `togglePin`, `saveUserNote`, `deleteScrap`으로 Firestore 문서를 갱신·삭제하고 `openSafeUrl`, `window.confirm`/`alert`, `scrollBodyRef.current.scrollTo`를 호출합니다.
- `[ScrapItem.jsx]` — `ScrapContext`의 `updateScrap`, `togglePin`, `saveUserNote`, `deleteScrap`으로 Firestore 문서를 갱신·삭제하고, 미분석 항목 지연 분석 시 `scrapeUrl`/`analyzeContent`를 호출하며, `openSafeUrl`과 `window.confirm`/`alert`를 사용합니다.
- `[SmartSummaryView.jsx]` — `ScrapContext`의 `toggleCheckedItem`, `resetCheckedItems`를 통해 Firestore `checkedItems`를 갱신하고, `openSafeUrl`로 YouTube 타임스탬프 링크를 새 탭에서 엽니다.
- `[ScrapList.jsx]` — `localStorage`(`oms_desktop_list_width`) 읽기/쓰기, `window` `resize` 및 포인터 드래그(`pointermove`/`pointerup`/`pointercancel`/`blur`) 리스너, `document` `keydown`, `ResizeObserver`, 태그 바 `wheel` 이벤트, `document.body.style`(`cursor`/`userSelect`) 변이, `window.scrollTo`/`scrollIntoView` 호출을 수행합니다.
- `[AskArchiveModal.jsx]` — `[gemini.js:askMyScraps]`를 호출하고 `document` `keydown`(`Escape`) 리스너 등록 및 메시지 영역 자동 스크롤(`scrollIntoView`)을 수행합니다.
- `[RediscoverBanner.jsx]` — `localStorage`(`oms_rediscover_dismissed`)에 일일 닫기 날짜를 저장합니다.
- `[QuickToolsModal.jsx]` — `navigator.clipboard.writeText`, `document` `keydown`(`Escape`) 리스너, `bookmarkletRef.current.setAttribute("href", ...)` DOM 직접 변이, `useTranslation().setLanguage` 호출 및 `window.alert`를 수행합니다.

## Verification
- Run: `npm run lint`
