# Components (`src/components`)

## Overview
URL 스크랩의 추가(중복 감지·클립보드 제안 포함), 재분석, 리스트/카드 조회, 태그·상태·날짜 필터링, 도메인별 스마트 요약 렌더링, 인라인 편집·개인 메모, Ask AI 보관함 질의응답, 타임캡슐 재발견 배너, PWA/북마클릿/UID 퀵 도구 모달을 제공합니다.

## Interface
- `[AddScrapDialog.jsx:AddScrapDialog]` — URL 스크래핑, 실시간 중복 URL 감지, 클립보드 URL 제안, AI/비-AI 요약, Firestore 문서 생성을 오케스트레이션하는 모달 컴포넌트(`{ onClose, initialUrl, onViewExisting }`)입니다. `localLang` 상태는 전역 `preferredLanguage`로 초기화되며 해당 스크랩의 AI 분석 언어만 개별 재정의합니다.
- `[ReAnalyzeDialog.jsx:ReAnalyzeDialog]` — 기존 스크랩 항목을 다시 스크래핑(YouTube 자막 폴백 포함)하고 재분석하는 모달 컴포넌트(`{ scrap, onClose, onSuccess }`)입니다.
- `[ScrapItem.jsx:ScrapItem]` — 개별 스크랩 행/카드를 렌더링하고 핀 상태 배지, 클릭형 태그, 모바일 확장 상세(스마트 요약·개인 메모·인라인 편집)를 제공하는 컴포넌트입니다.
- `[ScrapList.jsx:ScrapList]` — `ScrapContext` 데이터를 기반으로 검색(제목·요약·태그·메모), 날짜·상태(핀)·태그 클라우드 필터링, 핀 우선 정렬, 타임캡슐 배너, Ask AI 모달, 데스크톱 분할 상세 패널을 조율합니다.
- `[ScrapDetailPane.jsx:ScrapDetailPane]` — 데스크톱 우측 상세 패널로 핀 토글, 인라인 편집(제목/태그/요약), `SmartSummaryView`, 개인 메모(`userNote`), 재분석·원문 보기·삭제를 제공합니다.
- `[SmartSummaryView.jsx:SmartSummaryView]` — `contentType`(`recipe`, `tech`, `video`, `place`, `product`, `general`) 및 `[섹션]` 구조를 파싱해 레시피 체크리스트(Firestore `checkedItems` 동기화)와 클릭 가능한 YouTube 타임스탬프 필(`[MM:SS]`)을 렌더링합니다.
- `[AskArchiveModal.jsx:AskArchiveModal]` — 보관함 전체에 자연어 질문을 던지고 답변·출처 스크랩 카드·후속 질문을 표시하는 AI Q&A 모달(`{ onClose, onSelectScrap, initialQuestion }`)입니다.
- `[RediscoverBanner.jsx:RediscoverBanner]` — 1주/1개월/3개월/1년 전 타임캡슐 또는 랜덤 스크랩을 추천하고 셔플 및 일일 닫기를 지원하는 배너(`{ scraps, onSelectScrap }`)입니다.
- `[QuickToolsModal.jsx:QuickToolsModal]` — 언어 설정(EN/KO, 앱 UI 및 AI 기본 언어 연동), PWA 설치/모바일 Share Sheet 안내, 드래그·복사용 데스크톱 북마클릿, 개인 UID 복사 UI를 제공하는 모달(`{ onClose, deferredPrompt, onInstallPwa }`)입니다.

## Invariants
- `[AddScrapDialog.jsx:AddScrapDialog]` — `duplicateScrap`이 감지되면 `allowDuplicate`를 명시적으로 허용하기 전까지 중복 제출을 차단하고 기존 항목 보기·재분석·무시 저장 선택지를 제공합니다.
- `[AddScrapDialog.jsx:handleSubmit]` / `[ReAnalyzeDialog.jsx:handleAnalyze]` — `[scraper.js:applyRequiredTags]`를 통해 강제 사이트 태그 및 `"YouTube"` 태그를 보장하며 최대 3개 태그와 `contentType`을 저장합니다.
- `[ScrapList.jsx:filteredScraps]` — 검색어, 태그, 상태(`pinned`), 날짜(`all`/`today`/`week`/`month`/`older`) 필터를 모두 적용한 뒤 `isPinned` 항목을 최상단에 우선 정렬합니다.
- `[ScrapDetailPane.jsx:ScrapDetailPane]` — `key={selectedScrap.id}`로 마운트되어 선택 항목 변경 시 로컬 편집 상태를 안전하게 초기화합니다.
- `[QuickToolsModal.jsx:QuickToolsModal]` — JSX 내 `javascript:` URL 경고를 피하기 위해 북마클릿 `href`를 `useEffect`에서 DOM ref에 직접 설정합니다.

## Side Effects
- `[AddScrapDialog.jsx]` — `navigator.permissions`/`navigator.clipboard.readText()`, `paste`/`keydown` 리스너, `scrapeUrl`, `analyzeContent`, `addDoc(collection(db, "scraps"), ...)`를 호출합니다.
- `[AskArchiveModal.jsx]` — `[gemini.js:askMyScraps]`를 호출하고 메시지 영역을 자동 스크롤합니다.
- `[RediscoverBanner.jsx]` — `localStorage`(`oms_rediscover_dismissed`)에 일일 닫기 날짜를 저장합니다.
- `[ScrapDetailPane.jsx]` / `[ScrapItem.jsx]` — `ScrapContext`의 `updateScrap`, `togglePin`, `saveUserNote`, `toggleCheckedItem`, `resetCheckedItems`, `deleteScrap`을 통해 Firestore `scraps/{id}` 문서를 갱신·삭제합니다.

## Verification
- Run: `npm run lint`
