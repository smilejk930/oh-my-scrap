# Firestore Database 초기 설정 및 에러 해결 가이드

## 발생 가능한 주요 에러
```text
@firebase/firestore: Firestore (12.12.0): Database '(default)' not found. Please check your project configuration.
```

이 에러는 프론트엔드 코드에서는 Firestore 데이터베이스에 접근하려고 시도하지만, 실제 Firebase 서버 측(콘솔)에는 아직 데이터베이스 공간(인스턴스)이 생성되지 않았을 때 발생합니다.

## 해결 방법 (데이터베이스 생성)

아래 순서대로 Firebase 콘솔에서 데이터베이스를 활성화(생성)해 주시면 바로 해결됩니다.

1. **[Firestore Database 설정 페이지](https://console.firebase.google.com/project/oh-my-scrap/firestore/data)**로 접속합니다.
2. 화면 중앙 또는 상단에 있는 **데이터베이스 만들기 (Create database)** 버튼을 클릭합니다.
3. 데이터베이스 위치(Location)를 묻는 창이 나타나면 드롭다운에서 **`asia-northeast3 (Seoul)`** 을 선택하고 다음을 클릭합니다. (앱의 주 사용자가 한국에 있다면 가장 빠릅니다.)
4. 보안 규칙 수준을 정하는 창에서 **테스트 모드에서 시작 (Start in test mode)** 또는 **프로덕션 모드 (Start in production mode)** 중 하나를 선택하시고 **사용 설정 (Enable)** 버튼을 누릅니다.
   *(이후 배포를 진행할 때 로컬에 있는 `firestore.rules` 파일 규칙으로 덮어씌워지므로 둘 중 아무거나 선택하셔도 무방합니다.)*
5. 로딩이 끝나면서 빈 데이터베이스 화면(데이터 패널)이 표시된다면 생성이 완료된 것입니다.

여기까지 모두 완료하셨다면, 실행 중인 웹 브라우저(localhost) 화면을 **새로고침** 하세요. 에러가 사라지고 데이터베이스 저장이 정상적으로 동작합니다.
