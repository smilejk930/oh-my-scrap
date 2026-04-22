---
description: 이 워크플로우는 소스 코드를 빌드하고, Firebase 보안 규칙을 검증하며, 최종적으로 Firebase Hosting 및 Firestore에 배포하는 과정을 자동화합니다.
---

# Firebase Deployment Workflow

## Steps

1. **프로젝트 빌드**
   - `npm run build` 명령어를 실행하여 `dist` 디렉토리에 정적 파일을 생성합니다.
   - 빌드가 성공적으로 완료되었는지 확인합니다.

2. **Firestore 보안 규칙 검증**
   - `firebase-mcp-server`의 `firebase_validate_security_rules` 도구를 사용합니다.
   - Arguments: `{ "type": "firestore", "source_file": "firestore.rules" }`
   - 결과가 "OK: No errors detected." 인지 확인합니다.

3. **Firebase 활성 프로젝트 설정**
   - `firebase-mcp-server`의 `firebase_update_environment` 도구를 사용하여 활성 프로젝트를 `oh-my-scrap`으로 설정합니다.
   - Arguments: `{ "active_project": "oh-my-scrap" }`

4. **Firebase 배포 실행**
   - `npx firebase-tools deploy --only hosting,firestore --project oh-my-scrap` 명령어를 실행합니다.
   - 배포가 완료되고 Hosting URL이 정상적으로 출력되는지 확인합니다.
