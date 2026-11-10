# Firebase (`src/firebase`)

## Overview
Vite 환경 변수로부터 Firebase 애플리케이션 인스턴스를 초기화하고, Firebase Authentication, Google OAuth, Cloud Firestore의 싱글턴 핸들을 내보냅니다.

## Interface
- `[firebase.js:auth]` — `getAuth(app)`을 통해 생성되어 내보내지는 Firebase Authentication 인스턴스입니다.
- `[firebase.js:googleProvider]` — `new GoogleAuthProvider()`를 통해 생성되어 내보내지는 `GoogleAuthProvider` 인스턴스입니다.
- `[firebase.js:db]` — `getFirestore(app)`을 통해 생성되어 내보내지는 Cloud Firestore 인스턴스입니다.

## Invariants
- 없음 (`None`)

## Side Effects
- `[firebase.js:firebaseConfig]` — 모듈 평가 시점에 Vite 환경 변수(`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`)를 읽습니다.
- `[firebase.js:app]` — 모듈 로드 시점에 `initializeApp(firebaseConfig)`을 호출합니다.
- `[firebase.js:auth]` — 모듈 로드 시점에 `getAuth(app)`을 호출합니다.
- `[firebase.js:googleProvider]` — 모듈 로드 시점에 `GoogleAuthProvider` 인스턴스를 생성합니다.
- `[firebase.js:db]` — 모듈 로드 시점에 `getFirestore(app)`을 호출합니다.

## Verification
- Run: `npm run lint`
