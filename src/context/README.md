# Context (`src/context`)

## Overview
Firebase Authentication과 Firestore `users/{uid}` 문서 간에 실시간으로 동기화되는 애플리케이션 전역 인증 상태 및 사용자별 설정(`language`, `useAi`)을 제공합니다.

## Interface
- `[AuthContext.jsx:AuthProvider]` — Firebase Authentication 상태를 관리하고 Firestore로부터 사용자별 설정을 실시간 동기화하는 React 컨텍스트 프로바이더 컴포넌트입니다.
- `[AuthContext.jsx:useAuth]` — `{ user, login, logout, updateLanguage, updateUseAi, preferredLanguage, useAi, loading }`을 반환하는 커스텀 React 훅입니다.

## Invariants
- `[AuthContext.jsx:AuthProvider]` — Firestore `users/{uid}` 문서가 존재하지 않을 때 초기 사용자 설정은 `{ language: "en", useAi: false }`로 기본 설정됩니다.
- `[AuthContext.jsx:AuthProvider]` — `preferredLanguage`의 기본값은 `"en"`(`user?.settings?.language || "en"`)이며, `useAi`의 기본값은 `false`(`user?.settings?.useAi ?? false`)입니다.
- `[AuthContext.jsx:AuthProvider]` — 하위 `children`은 `loading`이 `false`일 때만 렌더링됩니다(`{!loading && children}`).
- `[AuthContext.jsx:updateLanguage]` — `user`가 없을 경우 Firestore를 수정하지 않고 즉시 반환합니다.
- `[AuthContext.jsx:updateUseAi]` — `user`가 없을 경우 Firestore를 수정하지 않고 즉시 반환합니다.

## Side Effects
- `[AuthContext.jsx:AuthProvider]` — 마운트 시 `onAuthStateChanged(auth, ...)`로 Firebase Auth 상태 변화를 구독하고 언마운트 시 구독을 해제합니다.
- `[AuthContext.jsx:AuthProvider]` — 로그인 시 `onSnapshot`을 통해 Firestore `users/{authUser.uid}` 문서를 실시간 구독하고, 로그아웃 또는 언마운트 시 구독을 해제합니다.
- `[AuthContext.jsx:AuthProvider]` — `users/{authUser.uid}` 문서가 존재하지 않으면 `setDoc`을 호출해 초기 사용자 설정 문서를 생성합니다.
- `[AuthContext.jsx:login]` — `signInWithPopup(auth, googleProvider)`를 통해 Google OAuth 팝업 로그인을 실행합니다.
- `[AuthContext.jsx:logout]` — `signOut(auth)`를 통해 현재 사용자를 Firebase Auth에서 로그아웃시킵니다.
- `[AuthContext.jsx:updateLanguage]` — `setDoc(..., { merge: true })`를 통해 Firestore `users/{user.uid}` 문서에 `{ language: lang }`을 병합 저장합니다.
- `[AuthContext.jsx:updateUseAi]` — `setDoc(..., { merge: true })`를 통해 Firestore `users/{user.uid}` 문서에 `{ useAi: val }`을 병합 저장합니다.

## Verification
- Run: `npm run lint`
