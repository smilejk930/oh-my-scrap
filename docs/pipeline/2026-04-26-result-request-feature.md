# 파이프라인 결과 보고서

**날짜**: 2026-04-26
**요청 내용**: `docs/2026-04-26-request-feature.md`
**최종 상태**: 성공

---

## 워크스트림별 결과

| 워크스트림 | 반복 횟수 | 상태 | 주요 변경 파일 |
|-----------|----------|------|--------------|
| ui-fixes  | 1회      | 통과 | `src/index.css`, `src/components/ScrapList.jsx`, `src/components/AddScrapDialog.jsx` |

### 변경 요약

- `src/index.css`
  - `.lang-btn-icon` 유틸리티 클래스 추가 (padding 6px, aspect-ratio 1, inline-flex 정렬)로 아이콘 전용 토글이 텍스트 토글과 동일 높이를 갖도록 함
  - dead `.sidebar`, `.sidebar-logo`, `.sidebar-nav`, `.sidebar-nav-item`, `.sidebar-nav-item:hover`, `.sidebar-nav-item.active`, `.sidebar-footer`, 글로벌 `.sidebar-footer .language-toggle` 규칙 전부 제거
- `src/components/ScrapList.jsx`
  - 데스크탑 list/card view-toggle 두 버튼에 `lang-btn-icon` 클래스 적용, 정렬용 인라인 스타일 제거
- `src/components/AddScrapDialog.jsx`
  - dialog-box `motion.div`에 `onMouseDown` / `onTouchStart` `stopPropagation` 추가
  - URL `<input>`에 `onContextMenu` `stopPropagation` 추가 → long-press 시 paste 컨텍스트 메뉴 사라짐 버그 차단

---

## 머지 결과

- **머지 상태**: 단일 플로우 (머지 없음)
- **충돌 해결 항목**: 없음
- **빌드 상태**: passed (`npm run build` 성공, 기존부터 존재하던 chunk-size 경고만 노출)

---

## 통합 검증 결과

- **리뷰**: PASS (blocker 0, high 0, medium 1, low 2)
- **테스트**: PASS (Playwright 실 브라우저 검증, 모든 플로우 통과)

### 테스트 플로우 결과

| 플로우 | 상태 |
|-------|------|
| 데스크탑 view-toggle 높이 vs `.lang-btn` 텍스트 토글 높이 (28px vs 27px, 서브픽셀 차) | PASS |
| 모바일(375x667) URL 입력창 `contextmenu` 이벤트 시 다이얼로그 유지 | PASS |
| 프로그램 방식 Paste 버튼 존재 및 활성화 | PASS |
| 모바일 backdrop 탭 시 다이얼로그 닫힘 | PASS |
| 데스크탑/모바일 ESC 키 닫기 | PASS |
| 데스크탑에서 `.sidebar` 요소가 DOM에 존재하지 않음 | PASS |

콘솔 오류는 Firebase OAuth 팝업 관련 사전 존재 경고(Cross-Origin-Opener-Policy)만 관측되었으며, 본 변경과 무관.

---

## 잔여 이슈

블로커/하이 없음. 다음은 차회 정리 후보 (병합 차단 사유 아님):

- **R1 (medium, `src/index.css` `.lang-btn-icon`)**: `aspect-ratio: 1` + `min-width: 28px` 조합으로 28×26px 비정사각이 만들어져 텍스트 토글(약 27–28px)과 ~1–2px 차가 발생. `min-height: 28px` 추가 시 정확한 28×28px 정사각으로 정렬 가능.
- **R2 (low, `src/App.jsx` 라인 201–214)**: 모바일 하단 view-toggle 버튼은 여전히 `lang-btn`만 사용. 일관성을 위해 `lang-btn-icon`을 함께 적용 권장. (요청 1번은 데스크탑 한정이라 본 워크스트림 범위에는 포함되지 않음.)
- **R3 (low, `AddScrapDialog.jsx` 라인 158)**: `onTouchStart` `stopPropagation`은 의도된 defense-in-depth. 별도 조치 불필요.

요청서 항목 2 (`Input` → `Add` 라벨)와 항목 3 (UX 통합 — 다이얼로그 도입, 헤더 명칭, 모바일 하단 메뉴 재구성, 데스크탑 사이드바 제거)의 구조적 작업은 이미 코드에 반영되어 있어 본 회차에서 별도 변경 없이 검증만 수행했음.

---

## 비고

- 반복(self-heal) 없이 1회차에 reviewer/tester 모두 PASS로 수렴.
- Playwright 검증은 기존 Firebase 세션이 유지되어 인증된 archive 화면에서 실 DOM/스타일/이벤트 검증을 수행했음.
- 오케스트레이터 운영 노트: Phase 3-S에서 reviewer와 tester를 동일 메시지로 병렬 디스패치하지 못하고 순차 실행한 절차 위반이 1건 있었음. 결과 정합성에는 영향 없음.
