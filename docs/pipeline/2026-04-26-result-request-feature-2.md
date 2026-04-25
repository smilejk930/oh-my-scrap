# 파이프라인 결과 보고서

**날짜**: 2026-04-26
**요청 내용**: `@docs/2026-04-26-request-feature-2.md` (데스크탑 상세보기 정리, Add 버튼 재배치, 사용자 아바타 추가, 스크랩 재분석 기능)
**최종 상태**: 성공 (5개 요구사항 모두 충족, 통합 리뷰·테스트 PASS)

---

## 워크스트림별 결과

| 워크스트림 | 반복 횟수 | 상태 | 주요 변경 파일 |
|-----------|----------|------|--------------|
| `chrome-ui` | 1회 | 통과 | `src/App.jsx`, `src/components/ScrapList.jsx`, `src/index.css` |
| `reanalyze` | 2회 | 통과 (R1 고치고 통과) | `src/components/ReAnalyzeDialog.jsx` (신규), `src/components/ScrapItem.jsx`, `src/index.css` |
| `integration-fix` | 1회 | 통과 | `src/App.jsx` (모달 흐름 복원, 토글 컴포넌트 모듈 스코프로 호이스트), `src/components/InputSection.jsx` 삭제 |

### `chrome-ui`
- 데스크탑 상세 패널에서 View Original / Delete 버튼 제거
- 상세 패널 썸네일 클릭 시 `window.open(scrap.url, '_blank', 'noopener,noreferrer')`
- 데스크탑 서브헤더에서 목록/카드 토글 오른쪽에 Plus 버튼 배치 (`onAddClick` prop)
- 데스크탑 사이드바 푸터 / 모바일 헤더 양쪽에 `.user-avatar` (이름 첫 글자) 추가, fallback 체인은 `displayName → email → '?'`
- `src/index.css` 에 `.user-avatar` 룰 append (36px 원형, accent-color 배경)

### `reanalyze`
- 신규 `ReAnalyzeDialog.jsx` 생성 — `dialog-overlay` / `dialog-box` / `language-toggle` / `lang-btn` / `btn` 클래스 재사용
- OFF/AI, EN/KO 토글은 **로컬 state만** 사용 (`updateLanguage` / `updateUseAi` 호출 없음 → 전역 사용자 설정 미변경)
- `scrapeUrl → analyzeContent` 파이프라인 재사용, 분기 로직(`useAi=false` / `skipAi=true` / 정상 AI)은 ADD 다이얼로그와 동일
- `getForcedSiteTag` 적용으로 `news.hada.io` 등 GeekNews 강제 태그 보존
- Esc 처리: 분석 중에는 닫히지 않음 (`!analyzing` 가드)
- `ScrapItem.jsx` 카드/리스트 모드 양쪽에 `RefreshCw` 아이콘 버튼 추가 (accent-color, `e.stopPropagation()`)
- **반복 1 → 2 변경 사항**: thumbnail 가드를 `if (thumbnail)` → `if (thumbnail && thumbnail !== "/placeholder.svg")` 로 강화 (R1 high 해결)

### `integration-fix` (머지 후 통합 검증에서 발견된 회귀에 대한 단일 패스)
- 머저가 워크스트림의 더 오래된 base 커밋(1185004)을 기준으로 변경을 적용하면서 `InputSection.jsx` 탭 네비게이션을 도입하고 기존 `AddScrapDialog` 모달 흐름을 비활성화시킨 회귀를 발견
- `src/App.jsx` 를 pre-merge 커밋(7839037) 기준으로 복원 — `AddScrapDialog` 재import, `isDialogOpen` state, `AnimatePresence` 래퍼 복원
- `LanguageToggle`, `AiToggle` 컴포넌트를 `MainApp` 본문 밖 모듈 스코프로 호이스트 (react-hooks/static-components 에러 해결)
- `src/components/InputSection.jsx` 삭제 (모달 흐름 복원에 따라 더 이상 도달 불가능한 고아 파일)
- chrome-ui 가 추가한 `.user-avatar` 와 `onAddClick` 배선은 그대로 유지

---

## 머지 결과

- **머지 상태**: 성공 (단, 워크스트림 worktree 들이 더 오래된 공통 조상에서 분기되어 있어 표준 `git merge --no-ff` 가 no-op 이 되는 상황이었고, 머저가 변경 사항을 새 커밋으로 메인 브랜치에 적용)
- **충돌 해결 항목**:
  - `src/index.css` 의 `.dialog-*` 클래스는 이미 `claude-agents` 에 존재 → reanalyze worktree 의 중복 정의는 추가하지 않음
  - `.user-avatar` 클래스는 누락 → chrome-ui 단계에서 append
- **빌드 상태**: passed
- **부수 효과**: 머저가 `InputSection.jsx` 신규 생성 + 탭 네비게이션 도입이라는 의도치 않은 UX 변경을 일으켰고, 이는 통합 리뷰에서 BLOCKER 로 잡혀 `integration-fix` 패스로 즉시 복원됨

---

## 통합 검증 결과 (최종)

| 검증 단계 | 리뷰 | 테스트 |
|----------|------|-------|
| 머지 직후 (1차) | **FAIL** — 모달 흐름 회귀 (BLOCKER), 고아 파일 (HIGH), 컴포넌트 in-render (HIGH) | PASS (라이브 브라우저 검증 — 15/15 flow 통과) |
| `integration-fix` 후 (2차) | **PASS** | **PASS** |

### 최종 검증된 5개 요구사항

| # | 요구사항 | 상태 | 근거 |
|---|---------|------|------|
| 1 | 상세 패널 View Original / Delete 버튼 제거 | PASS | `src/components/ScrapList.jsx:187-235` — 상세 패널은 close X / 썸네일 / title / tags / summary 만 |
| 2 | 상세 패널 썸네일 클릭 → 원본 사이트 이동 | PASS | `src/components/ScrapList.jsx:204` — `window.open(scrap.url, '_blank', 'noopener,noreferrer')` + aria-label |
| 3 | 데스크탑에서 Add 버튼을 목록/카드 토글 오른쪽으로 | PASS | `src/components/ScrapList.jsx:119-156` (`.desktop-only` 가드) + `src/App.jsx:230` (`onAddClick={() => setIsDialogOpen(true)}`) → AddScrapDialog 모달 오픈 |
| 4 | 데스크탑/모바일 모두 로그아웃 오른쪽에 사용자 첫 글자 아바타 | PASS | `src/App.jsx:174-176` (모바일), `src/App.jsx:223-225` (데스크탑) — `(displayName \|\| email \|\| '?').charAt(0).toUpperCase()` |
| 5 | 스크랩별 재분석 기능 (RefreshCw → ReAnalyzeDialog) | PASS | `src/components/ScrapItem.jsx:89,174` (카드/리스트) + `src/components/ReAnalyzeDialog.jsx` — OFF/AI · EN/KO 로컬 토글, Analyze 버튼, `updateDoc` 으로 title/tags/fullSummary 갱신, `/placeholder.svg` 보호 가드 |

라이브 브라우저 테스트(통합 1차)에서 추가로 확인된 사항:
- 사이드바 모달 vs 서브헤더 Plus 버튼: 두 버튼 모두 동일한 `setIsDialogOpen(true)` 핸들러로 연결 — 중복 없이 동일 효과
- ReAnalyzeDialog 의 OFF/AI 토글이 로컬 상태만 변경하고 전역 사이드바 토글은 그대로 유지됨을 DOM 으로 확인
- Analyze 버튼이 분석 중 disabled + Loader2 spinner 표시
- `Escape` 키가 분석 중에는 무시되고 idle 상태에서만 닫힘 (synchronous dispatch 로 검증)
- RefreshCw 클릭이 카드/행의 부모 onClick 으로 propagate 되지 않음 (`e.stopPropagation()`)

---

## 잔여 이슈

모두 **medium/low** 등급이며 사용자 요구사항을 차단하지 않음. 후속 작업으로 별도 처리 권장.

| ID | 등급 | 위치 | 내용 |
|----|------|------|------|
| R-deferred-1 | medium | `src/components/ReAnalyzeDialog.jsx:137-138` | 에러 시 `alert(error.message)` 가 raw API 에러 메시지를 노출 → 사용자 친화적 메시지로 sanitize 권장 |
| R-deferred-2 | medium | `src/components/ReAnalyzeDialog.jsx:23-47` | `generateBasicTags` / `getForcedSiteTag` / `normalizeYoutubeUrl` 가 `AddScrapDialog.jsx` / `scraper.js` 와 중복 → `src/services/tagUtils.js` 로 추출 권장 |
| R-deferred-3 | low | `src/App.jsx:6` (외 다수) | ESLint `no-unused-vars` 가 `motion` 을 false-positive 로 잡음 (framer-motion namespace JSX 인식 불가). `AddScrapDialog.jsx` 처럼 `Motion` 으로 alias 하거나 lint 설정의 `varsIgnorePattern` 보강 |
| R-deferred-4 | low | `src/App.jsx:297` | `AddScrapDialog` 가 분석 중에 닫힐 때 in-flight 스크레이프/AI 호출은 백그라운드에서 계속 실행됨. 데이터 손상 위험은 없으나 abort signal 도입 시 더 깔끔 |
| R-deferred-5 | low | `src/components/ReAnalyzeDialog.jsx:103` | `skipAi` 분기에서 `setAnalyzing(false)` 호출이 없으나 직후 `onClose()` 로 언마운트되어 실제 위험은 없음. 방어적으로 추가 가능 |

---

## 비고

- **머저의 의도치 않은 변경**: 워크스트림 worktree 들이 `claude-agents` HEAD 가 아닌 `1185004` 공통 조상을 base 로 분기되어 있었기 때문에, 머저는 표준 `git merge` 대신 worktree 내용을 메인 브랜치에 새로 commit 하는 방식으로 진행했고, 그 과정에서 base 커밋의 `InputSection.jsx` 탭 패턴을 부활시키고 `AddScrapDialog` 모달을 사실상 비활성화함. 통합 리뷰에서 즉시 검출되어 `integration-fix` 패스로 복원되었음. 향후 동일 상황 방지를 위해 worktree 분기 시점이 `git merge-base claude-agents` 와 일치하는지 사전 확인 권장.
- **테스트 환경 한계**: 1차 통합 테스트에서는 사용자의 활성 Firebase 세션을 활용해 실제 브라우저로 15개 flow 를 모두 검증할 수 있었으나, 일부 워크스트림 단위 테스트는 Google OAuth headless 제한으로 정적 코드 검증에 의존했음. 정적 검증의 결과는 1차 통합 라이브 테스트 결과와 일치함.
- **빌드 청크 사이즈 경고 (>500 kB)** 는 사전 존재하던 경고로 본 작업과 무관함.
