# 파이프라인 계획 보고서

**날짜**: 2026-04-26
**요청 내용**: `@docs/2026-04-26-request-feature-2.md` (데스크탑 상세보기 정리, Add 버튼 재배치, 사용자 아바타 추가, 스크랩 재분석 기능)
**실행 방식**: 2개 병렬 워크스트림 (git worktree 기반 격리)

---

## 워크스트림 목록

### 워크스트림 1: `chrome-ui`
- **목표**: 데스크탑 상세보기에서 View Original / Delete 버튼 제거, 썸네일 클릭 시 원본 이동, Add 버튼을 목록/카드뷰 토글 오른쪽으로 이동, 데스크탑·모바일 양쪽 헤더에 로그아웃 버튼 오른쪽으로 사용자 이름 첫 글자 아바타 추가
- **주요 작업 파일**:
  - `src/App.jsx` — 데스크탑/모바일 헤더에서 Add 버튼 제거, 사용자 아바타 추가, `onAddClick` prop 전달
  - `src/components/ScrapList.jsx` — 상세보기 버튼 영역 제거, 썸네일 클릭 핸들러, 서브헤더에 Add 버튼 배치
  - `src/index.css` — `.user-avatar` 클래스 추가
- **의존성**: 없음 (본 워크스트림 단독으로 빌드/검증 가능)
- **주요 UI 플로우** (테스터 검증용):
  - 데스크탑 상세 패널에 View Original / Delete 버튼이 없는지 확인
  - 데스크탑 상세 패널 썸네일 클릭 시 원본 URL 새 탭 오픈
  - 데스크탑 서브헤더에서 목록/카드 토글 오른쪽에 Add(Plus) 버튼이 표시되는지 확인
  - 데스크탑/모바일 헤더에서 Sign Out / LogOut 오른쪽에 첫 글자 아바타가 표시되는지 확인

### 워크스트림 2: `reanalyze`
- **목표**: 각 스크랩별로 새로고침(RefreshCw) 아이콘 버튼을 노출하고, 클릭 시 OFF/AI 토글 + EN/KO 토글 + Analyze 버튼으로 구성된 다이얼로그를 띄워 재분석 결과로 Firestore 문서를 갱신 (토글 UI는 기존 ADD 다이얼로그와 동일한 스타일 사용)
- **주요 작업 파일**:
  - `src/components/ReAnalyzeDialog.jsx` — 신규 생성
  - `src/components/ScrapItem.jsx` — RefreshCw 아이콘 버튼 + 다이얼로그 트리거 추가
- **의존성**: 없음 (본 워크스트림 단독으로 빌드/검증 가능)
- **주요 UI 플로우** (테스터 검증용):
  - 카드 모드 / 리스트 모드 양쪽에서 RefreshCw 아이콘 버튼 클릭 시 다이얼로그 오픈
  - OFF/AI 토글 및 EN/KO 토글 동작 확인 (스타일이 ADD 다이얼로그와 동일)
  - Analyze 클릭 시 스피너 표시, 성공 후 Firestore 갱신 및 다이얼로그 자동 닫힘
  - Esc 키 처리 (분석 중에는 닫히지 않음)

---

## 공유 파일 및 충돌 주의 항목

- **`src/index.css`** — `chrome-ui` 가 `.user-avatar` 룰을 추가할 수 있고, `reanalyze` 는 기존 `.dialog-*` / `.language-toggle` 클래스를 재사용하므로 동시 수정 가능성은 낮으나 머지 시 단순 append 형태로 처리되어야 한다.
- **`src/components/ScrapItem.jsx`** — `chrome-ui` 는 본 파일을 수정하지 않으며, `reanalyze` 만 RefreshCw 트리거를 추가한다. 충돌 위험 낮음.
- 머지 후 검증 필요:
  - `App.jsx` 의 데스크탑 헤더에서 Add 버튼이 중복되지 않아야 함
  - `ScrapItem.jsx` 가 새로 생성된 `ReAnalyzeDialog.jsx` 를 정상적으로 import 하는지
  - `ScrapList.jsx` 에서 더 이상 detail pane delete 가 없으므로 불필요해진 `deleteDoc` import 가 제거되었는지

---

## 비고

- **위험 요소(planner 보고)**:
  - 항목 3(“Add 버튼을 목록/카드 토글 오른쪽에 배치”)은 `App.jsx` 상단 헤더가 아닌 `ScrapList` 서브헤더에 배치하는 것으로 해석됨 — 상단 헤더는 Sign Out + 아바타만 남김.
  - `generateBasicTags` / `getForcedSiteTag` 가 `AddScrapDialog.jsx` 에 비공개 함수로 존재 → `ReAnalyzeDialog` 가 일단 동일 로직을 복제하여 워크스트림 독립성을 확보. 추후 공통 모듈 추출은 기술 부채로 표기.
  - 재분석 시 `thumbnail` 필드도 함께 갱신하도록 계획 (스크랩 콘텐츠 변경 시 누락 방지). 사용자가 원본 썸네일을 보존해야 한다면 별도 피드백으로 조정.
  - 사용자 아바타: `displayName` → `email` → `'?'` 의 폴백 체인 적용.
