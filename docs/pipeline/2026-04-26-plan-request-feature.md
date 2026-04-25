# 파이프라인 계획 보고서

**날짜**: 2026-04-26
**요청 내용**: `docs/2026-04-26-request-feature.md`
**실행 방식**: 단일 플로우 (1개 워크스트림)

---

## 워크스트림 목록

### 워크스트림 1: ui-fixes
- **목표**: 데스크탑 view-toggle 아이콘 버튼 크기 보정, 사용하지 않는 sidebar CSS 제거, 모바일 long-press paste 컨텍스트 메뉴가 다이얼로그를 닫아버리는 버그 수정
- **주요 작업 파일**:
  - `src/index.css`
  - `src/components/ScrapList.jsx`
  - `src/components/AddScrapDialog.jsx`
- **의존성**: 없음
- **수락 기준 (acceptance_criteria)**:
  - 데스크탑에서 list/card view-toggle 버튼이 OFF/AI · EN/KO 토글 버튼과 동일한 높이로 정렬됨
  - `index.css` 내 dead `.sidebar*` 블록 제거
  - 모바일(Android/iOS)에서 URL 입력창 long-press 시 OS의 paste 컨텍스트 메뉴가 사라지지 않고 정상 표시됨
  - 다이얼로그의 프로그램 방식 Paste 버튼은 그대로 동작
  - 다이얼로그 backdrop 탭 시 닫힘 동작은 유지
- **UI 플로우 (브라우저 검증 대상)**:
  - 데스크탑: 앱 진입 → list/card 토글이 AI/EN 토글과 같은 높이임을 시각 확인
  - 모바일 Android: Add 다이얼로그 열기 → URL 입력창 long-press → paste 컨텍스트 메뉴 유지
  - 모바일 iOS: 동일 long-press 검증
  - 모바일: Paste 버튼 탭 → 클립보드 값 입력 정상
  - 모바일: 오버레이 탭 → 다이얼로그 닫힘 정상
  - 데스크탑: sidebar 요소가 더 이상 공간을 차지하지 않음

---

## 공유 파일 및 충돌 주의 항목

- **공유 파일**: `src/index.css` (item 1의 lang-btn 아이콘 사이징과 sidebar CSS 정리가 같은 파일에 위치)
- **공유 우려 사항**:
  - sidebar CSS 제거 후 desktop ≥769px 뷰포트에서 레이아웃 회귀가 없는지 확인
  - `.sidebar-footer .language-toggle` 제거가 `AddScrapDialog`의 토글 스타일에 영향을 주지 않는지 (다이얼로그는 `.dialog-controls > .language-toggle`을 사용 — 영향 없을 것으로 기대되나 검증 필요)
  - stopPropagation 추가가 ESC 키 닫기 경로(별도 keydown 리스너)에 영향을 주지 않는지 확인

---

## 비고

- 플래너 조사 결과 요청서의 **항목 2 (`Input` → `Add` 라벨 변경)**, **항목 3 (UX 통합 — 다이얼로그 도입, 헤더 명칭 변경, 모바일 하단 메뉴 개편, 데스크탑 사이드바 제거)** 의 핵심 구조는 이미 코드에 반영되어 있음. 본 워크스트림은 잔여 시각적/동작상 결함만 마무리한다.
- 위험 플래그:
  - `:has(svg)` CSS 선택자는 구형 Android WebView에서 미지원 가능성이 있어 explicit `.lang-btn-icon` 클래스를 JSX className으로 부여하는 방식을 권장
  - long-press paste 버그의 근본 원인이 overlay click 버블링이 아닌 다른 경로(예: AuthContext re-render에 의한 onFocus 부수효과)일 경우 추가 조사 필요
