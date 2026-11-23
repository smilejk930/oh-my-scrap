# Internationalization (`src/i18n`)

## Overview
앱 UI와 클라이언트 서비스 메시지에서 사용하는 영어(`en`)·일본어(`ja`)·한국어(`ko`)·중국어 간체(`zh`) 다국어 번역 사전, 언어 선택 옵션(`LANGUAGE_OPTIONS`), 그리고 `AuthContext` 연동 React 번역 훅을 제공합니다.

## Interface
- `[translations.js:SUPPORTED_LANGUAGES]` — 지원하는 언어 코드 배열(`["en", "ja", "ko", "zh"]`)입니다.
- `[translations.js:LANGUAGE_OPTIONS]` — 언어 선택 토글 UI용 옵션 배열(`[{ code: "en", label: "English" }, { code: "ja", label: "日本語" }, { code: "ko", label: "한국어" }, { code: "zh", label: "中文" }]`)입니다.
- `[translations.js:normalizeLanguage]` — `(lang) => "ja" | "ko" | "zh" | "en"`: 입력 언어 코드를 지원 언어로 정규화합니다(`"ja"`/`"ja-*"` → `"ja"`, `"ko"`/`"ko-*"` → `"ko"`, `"zh"`/`"zh-*"` → `"zh"`, 그 외 → `"en"`).
- `[translations.js:TRANSLATIONS]` — `en`, `ja`, `ko`, `zh` 네임스페이스별(`common`, `auth`, `nav`, `tools`, `dialog`, `list`, `detail`, `summary`, `rediscover`, `ask`, `service`) 번역 문자열 사전입니다.
- `[translations.js:translate]` — `(lang, key, params) => string`: 정규화된 언어 사전에서 `key`를 조회하고 `{{param}}` 템플릿 변수를 치환해 반환합니다.
- `[useTranslation.js:useTranslation]` — `[AuthContext.jsx:useAuth]`의 `preferredLanguage`와 `updateLanguage`를 연결해 `{ language, setLanguage, t }`를 반환하는 훅입니다.

## Invariants
- `[translations.js:normalizeLanguage]` — `"ja"`/`"ja-*"`, `"ko"`/`"ko-*"` 및 `"zh"`/`"zh-*"` 외의 모든 입력 값은 `"en"`으로 정규화됩니다.
- `[translations.js:translate]` — 요청 언어 사전에 키가 없으면 영어(`en`) 사전으로 폴백하며, 영어 사전에도 없으면 `key` 문자열 자체를 반환합니다. `params`가 전달되면 `{{paramKey}}` 플레이스홀더를 `String(paramValue ?? "")`로 치환합니다.

## Side Effects
- 없음 (`None`; 단, `[useTranslation.js:useTranslation]`이 반환하는 `setLanguage` 호출 시 `[AuthContext.jsx:updateLanguage]`를 통해 `localStorage` 및 Firestore `users/{uid}`를 갱신합니다.)

## Verification
- Run: `npm run lint`
