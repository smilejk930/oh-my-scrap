# Context (`src/context`)

## Overview
Firebase Authentication과 Firestore `users/{uid}` 문서 간 사용자 설정(`AuthContext`) 및 `scraps` 컬렉션의 실시간 목록, URL 정규화 기반 중복 감지, 문서 변이 헬퍼(`ScrapContext`)를 제공합니다.

## Interface
- `[AuthContext.jsx:AuthProvider]` — Firebase Authentication 상태를 관리하고 Firestore `users/{uid}` 설정을 실시간 동기화하는 컨텍스트 프로바이더입니다.
- `[AuthContext.jsx:useAuth]` — `{ user, login, logout, updateLanguage, updateUseAi, preferredLanguage, useAi, loading }`을 반환하는 훅입니다.
- `[ScrapContext.jsx:ScrapProvider]` — 로그인 사용자의 Firestore `scraps` 문서를 실시간 구독하고 중복 감지·편집·핀·읽음·메모·체크리스트 변이 함수를 제공하는 컨텍스트 프로바이더입니다.
- `[ScrapContext.jsx:useScraps]` — `{ scraps, loading, findDuplicateScrap, updateScrap, togglePin, toggleRead, markRead, saveUserNote, toggleCheckedItem, resetCheckedItems, deleteScrap }`을 반환하는 훅입니다.

## Invariants
- `[AuthContext.jsx:AuthProvider]` — `users/{uid}` 문서가 없을 때 초기 설정은 `{ language: "en", useAi: false }`로 생성되며, `loading`이 `false`일 때만 하위 트리를 렌더링합니다.
- `[ScrapContext.jsx:ScrapProvider]` — `snapshotState.uid`와 현재 로그인 `uid`를 비교해 사용자 전환 시 이전 사용자 데이터가 노출되지 않고 `loading` 상태가 일관되게 파생됩니다.
- `[ScrapContext.jsx:findDuplicateScrap]` — `[scraper.js:normalizeUrlForDedup]`로 정규화된 URL `Map`을 메모이즈하여 O(1)로 중복 스크랩을 조회합니다.

## Side Effects
- `[AuthContext.jsx:AuthProvider]` — `onAuthStateChanged`, `users/{uid}` `onSnapshot`, `setDoc`, `signInWithPopup`, `signOut`을 호출합니다.
- `[ScrapContext.jsx:ScrapProvider]` — `scraps` 컬렉션(`where("userId", "==", uid)`, `orderBy("createdAt", "desc")`)을 `onSnapshot`으로 구독하며 `updateDoc`/`deleteDoc`을 통해 `scraps/{id}` 문서를 수정·삭제합니다.

## Verification
- Run: `npm run lint`
