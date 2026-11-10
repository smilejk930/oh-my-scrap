---
name: firebase-deploy
description: 프로젝트 변경 사항을 분석하여 린트·빌드 검증을 수행하고 Firebase(Hosting, Firestore 규칙/인덱스 등)에 안전하게 배포한다. -f 옵션 전달 시 대화형 승인 없이 검증 후 즉시 배포한다.
---

# Firebase 배포 (`firebase-deploy`)

이 스킬은 프로젝트의 변경 사항을 확인하고, 사전 검증(Lint 및 Build)을 거친 뒤 Firebase CLI를 통해 안전하게 배포할 때 따르는 절차를 정의합니다.

---

## 1. 환경 및 변경 사항 분석

1. **Firebase 설정 확인**:
   - 프로젝트 루트의 `firebase.json`과 `.firebaserc`를 읽어 기본 프로젝트 ID(예: `oh-my-scrap`)와 설정된 배포 타겟(`hosting`, `firestore` 등)을 확인합니다.
2. **변경 사항 기반 배포 타겟 판별**:
   - `git status --short` 및 최근 변경 내역을 확인하여 배포 범위를 결정합니다.
   - **Hosting 단독 배포 (`--only hosting`)**: `src/`, `public/`, `index.html`, `vite.config.js`, `package.json` 등 웹 앱 코드만 변경된 경우
   - **Firestore 단독 배포 (`--only firestore:rules` 또는 `--only firestore:indexes`)**: `firestore.rules`나 `firestore.indexes.json`만 변경된 경우
   - **통합 배포 (`--only hosting,firestore`)**: 웹 앱 코드와 Firestore 설정이 모두 변경되었거나 사용자가 전체 배포를 요청한 경우
3. **셸 명령어 규칙**:
   - Windows PowerShell 환경이므로 여러 명령어를 한 줄로 이어서 실행할 때는 반드시 세미콜론(`;`)을 사용합니다.

---

## 2. 사전 검증 및 빌드 (Hosting 포함 시 필수)

배포 타겟에 `hosting`이 포함된 경우, 배포 전 반드시 아래 순서로 검증을 수행합니다.

1. **린트 검사**:
   - `npm run lint`를 실행하여 문법 및 정적 분석 오류가 없는지 확인합니다.
2. **프로덕션 빌드**:
   - `npm run build`를 실행하여 `dist/` 디렉터리에 최신 빌드 산출물이 생성되는지 확인합니다.
3. **실패 시 중단**:
   - 린트 또는 빌드 단계에서 오류가 발생하면 **절대 배포를 진행하지 않고**, 오류 원인을 사용자에게 보고하거나 수정합니다.

---

## 3. 배포 실행 정책 및 사용자 확인

- **자동 승인 옵션 (`-f`)**:
  - 사용자가 명령어에 `-f` 플래그를 전달하거나(예: `/firebase-deploy -f`, `바로 배포해줘 -f`), 프롬프트에 즉시 배포 의사를 명시한 경우:
    - 사전 검증(Lint·Build)이 통과하면 대화형 승인 절차(`ask_question`)를 건너뛰고 즉시 `npx firebase-tools deploy`를 실행합니다.
- **기본 승인 절차 (`-f` 미지정 시)**:
  - 사전 검증(Lint·Build) 완료 후, 아래 요약 정보를 제시하고 `ask_question` 도구로 사용자의 명시적 승인을 받습니다.
    ```markdown
    다음 설정으로 Firebase 배포를 진행하시겠습니까?

    - **대상 프로젝트**: `oh-my-scrap`
    - **배포 타겟**: `hosting` (또는 `hosting, firestore`)
    - **사전 검증**: Lint 통과 / Build 성공 (`dist/`)
    ```
  - `ask_question` 선택지 구성:
    - `"(Recommended) 예, 프로덕션에 바로 배포합니다"`
    - `"프리뷰 채널(Preview Channel)에 먼저 테스트 배포합니다"`
    - `"아니요, 배포를 취소합니다"`

---

## 4. 배포 실행 및 결과 검증

1. **프로덕션 배포 실행**:
   - 로컬 또는 전역 Firebase CLI를 사용하여 배포를 실행합니다:
     `npx firebase-tools deploy --only <target>`
2. **프리뷰 채널 배포 실행 (사용자가 프리뷰를 선택한 경우)**:
   - `npx firebase-tools hosting:channel:deploy preview --expires 7d`
3. **인증 오류 대응**:
   - 만약 Firebase CLI 인증 만료 또는 미로그인 오류가 발생하면, `npx firebase-tools login` 또는 `npx firebase-tools login --reauth` 실행을 안내합니다.
4. **배포 완료 보고**:
   - 배포 로그에서 `Deploy complete!` 여부와 출력된 **Hosting URL**을 확인하여 사용자에게 최종 결과를 안내합니다.
