# Oh My Scrap: 텔레그램 연동 가이드 (Google Apps Script)

Firebase Spark Plan(무료 요금제) 특성상 외부 네트워크 콜을 하는 Webhook을 Cloud Functions에 배포할 수 없습니다.
따라서, 사용하기 쉽고 무료인 **Google Apps Script(GAS)** 를 활용해 텔레그램 봇 Webhook을 구성하고 Firebase Firestore에 스크랩 데이터를 넣는 방식으로 연동합니다.

## 1. 텔레그램 봇 생성
1. 텔레그램에서 `BotFather`를 검색합니다.
2. `/newbot` 명령어를 입력해 봇을 생성하고, **API Token**을 발급받습니다.

## 2. Firebase 설정 준비
Firebase 프로젝트 설정에서 Web API Key (`VITE_FIREBASE_API_KEY`) 와 Project ID 를 확인합니다.

## 3. Google Apps Script(GAS) 설정
1. [script.google.com](https://script.google.com) 에 접속하여 새 프로젝트를 만듭니다.
2. `코드.gs`에 아래 코드를 복사해서 붙여넣습니다.

```javascript
const TELEGRAM_TOKEN = "여기에_텔레그램_봇_토큰_입력";
const FIREBASE_PROJECT_ID = "oh-my-scrap-XXXX"; // Firebase 프로젝트 ID
const FIREBASE_API_KEY = "여기에_파이어베이스_웹_API_KEY_입력";

// 내 Oh My Scrap 애플리케이션 접속 후 우측 상단의 [UID 복사] 버튼을 눌러 복사한 값
const TARGET_USER_ID = "여기에_내_오마이스크랩_UID_입력";

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const message = contents.message;
    
    if (message && message.text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.text.match(urlRegex);
      
      if (urls && urls.length > 0) {
        const urlToScrap = urls[0];
        
        // Firestore REST API를 이용해 데이터 삽입
        saveToFirestore(urlToScrap);
        
        sendMessage(message.chat.id, "✅ 파이어베이스에 스크랩이 저장되었습니다!\n앱에 접속하면 AI가 분석을 시작합니다.");
      } else {
        sendMessage(message.chat.id, "URL을 찾을 수 없습니다.");
      }
    }
    return ContentService.createTextOutput("OK");
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput("Error");
  }
}

function saveToFirestore(url) {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/scraps?key=${FIREBASE_API_KEY}`;
  
  const payload = {
    fields: {
      userId: { stringValue: TARGET_USER_ID },
      url: { stringValue: url },
      createdAt: { timestampValue: new Date().toISOString() },
      // title 등이 없으면 앱 접속 시 AI 스크래핑을 수행하게 됩니다.
      title: { stringValue: "" } 
    }
  };
  
  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch(firestoreUrl, options);
}

function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = { chat_id: chatId, text: text };
  
  UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}
```

## 4. Webhook 등록
1. GAS 프로젝트 우측 상단 **[배포] -> [새 배포]**를 클릭합니다.
2. 유형 선택에서 **웹 앱**을 선택합니다.
3. 액세스 권한을 **모든 사용자**로 설정하고 배포합니다.
4. **웹 앱 URL**이 발급되면 브라우저에서 아래 URL로 접속해 텔레그램 Webhook을 연결합니다.

```
https://api.telegram.org/bot[내_봇_토큰]/setWebhook?url=[GAS_웹_앱_URL]
```

## 5. 완료
이제 텔레그램 봇 대화방에 URL을 전송하면 Firestore에 저장되며, Oh My Scrap 앱 구동 시 "분석 대상" 스크랩 목록으로 나타납니다. 앱에서 AI 분석 버튼을 눌러 태그와 요약을 생성하세요!
