# Context (`src/context`)

## Overview
Firebase Authentication과 Firestore `users/{uid}` 문서 간 사용자 설정(`AuthContext`) 및 `scraps` 컬렉션의 실시간 목록, URL 정규화 기반 중복 감지, 문서 변이 헬퍼(`ScrapContext`)를 제공합니다.

## Interface
- `[AuthContext.jsx:AuthProvider]` — Firebase Authentication 상태를 관리하고 Firestore `users/{uid}` 설정을 실시간 동기화하는 컨텍스트 프로바이더입니다.
- `[AuthContext.jsx:useAuth]` — `{ user, login, logout, updateLanguage, updateUseAi, preferredLanguage, useAi, loading }`을 반환하는 훅입니다.
- `[ScrapContext.jsx:ScrapProvider]` — 로그인 사용자의 Firestore `scraps` 문서를 실시간 구독하고 중복 감지·편집·핀·읽음·메모·체크리스트 변이 함수를 제공하는 컨텍스트 프로바이더입니다.
- `[ScrapContext.jsx:useScraps]` — `{ scraps, loading, findDuplicateScrap, updateScrap, togglePin, toggleRead, markRead, saveUserNote, toggleCheckedItem, resetCheckedItems, deleteScrap }`을 반환하는 훅입니다(`toggleRead`·`markRead`는 컨텍스트에서 제공되지만 현재 UI 컴포넌트에서는 호출되지 않습니다).

## Invariants
- `[AuthContext.jsx:AuthProvider]` — `users/{uid}` 문서가 없을 때 초기 설정은 `{ language: readCachedLanguage(), useAi: false }`(캐시 미존재 시 `"en"`)로 생성되며, `loading`이 `false`일 때만 하위 트리를 렌더링합니다.
- `[AuthContext.jsx:AuthProvider]` — `preferredLanguage`는 `"en"`, `"ko"`, `"zh"`로 정규화되며, `localStorage`(`oms_language`) 캐시 및 `document.documentElement.lang`(`"zh"`는 `"zh-CN"`)과 동기화됩니다.
- `[AuthContext.jsx:updateLanguage]` / `[AuthContext.jsx:updateUseAi]` — `updateLanguage`는 비로그인(`!user`) 상태에서도 `localStorage`(`oms_language`)와 로컬 캐시 상태를 갱신하고, 로그인 시 낙관적 상태 업데이트 후 `setDoc(..., { merge: true })`로 병합 저장합니다. 반면 `updateUseAi`는 `!user`일 때 조기 반환하고 낙관적 업데이트 없이 `setDoc(..., { merge: true })`만 호출합니다.
- `[ScrapContext.jsx:ScrapProvider]` — `snapshotState.uid`와 현재 로그인 `uid`를 비교해 사용자 전환 시 이전 사용자 데이터가 노출되지 않고 `loading` 상태가 일관되게 파생되며, `onSnapshot` 오류 발생 시 `{ uid, items: [] }`로 폴백해 무한 로딩을 방지합니다.
- `[ScrapContext.jsx:findDuplicateScrap]` — `[scraper.js:normalizeUrlForDedup]`로 정규화된 URL `Map`을 메모이즈하여 O(1)로 중복 스크랩을 조회합니다.
- `[ScrapContext.jsx:saveUserNote]` / `[ScrapContext.jsx:toggleCheckedItem]` / `[ScrapContext.jsx:markRead]` — `saveUserNote`는 비문자열 입력을 `""`로 정규화하고 최대 5,000자(`slice(0, 5000)`)로 절단하며, `toggleCheckedItem`은 체크 항목 배열을 최대 100개(`slice(0, 100)`)로 제한합니다. `markRead`는 이미 `isRead === true`이면 조기 반환하고 업데이트 실패 시 예외를 던지지 않고 `console.warn`만 기록합니다.

## Side Effects
- `[AuthContext.jsx:AuthProvider]` — `onAuthStateChanged`, `users/{uid}` `onSnapshot`, `setDoc`, `signInWithPopup`, `signOut`, `localStorage`(`oms_language`), `document.documentElement.lang`을 갱신합니다.
- `[ScrapContext.jsx:ScrapProvider]` — `scraps` 컬렉션(`where("userId", "==", uid)`, `orderBy("createdAt", "desc")`)을 `onSnapshot`으로 구독하며 `updateDoc`/`deleteDoc`을 통해 `scraps/{id}` 문서를 수정·삭제합니다.

## Verification
- Run: `npm run lint`
