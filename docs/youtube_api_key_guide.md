# YouTube Data API v3 키 발급 가이드

Oh My Scrap은 YouTube 영상의 재생 시간을 확인해 긴 영상(기본 3분 초과)에서 Gemini AI 분석을 건너뜁니다.  
이 기능은 `VITE_YOUTUBE_API_KEY` 환경 변수가 설정되어 있어야 동작합니다. 키가 없으면 길이 확인이 생략되어 긴 영상 분석 시 Gemini 토큰 한도 오류가 발생할 수 있습니다.

## 1. Google Cloud Console 접속

[https://console.cloud.google.com](https://console.cloud.google.com) 에 접속합니다.

## 2. 프로젝트 선택 또는 생성

상단 프로젝트 드롭다운 → **새 프로젝트** 클릭.  
기존 Firebase 프로젝트가 있다면 해당 프로젝트를 재사용해도 됩니다.

## 3. YouTube Data API v3 활성화

1. 좌측 메뉴 **APIs & Services** → **Library** 클릭
2. `YouTube Data API v3` 검색
3. **Enable** 클릭

## 4. API 키 생성

1. **APIs & Services** → **Credentials** 클릭
2. **+ CREATE CREDENTIALS** → **API key** 선택
3. 생성된 키를 복사해 둡니다.

## 5. 키 제한 설정 (보안상 필수)

`VITE_` 접두사가 붙은 환경 변수는 빌드 결과물에 그대로 포함되어 브라우저에 노출됩니다. 반드시 아래 제한을 설정하세요.

1. 생성된 키의 **Edit** 진입
2. **Application restrictions** → `HTTP referrers (web sites)` 선택 후 허용 도메인 추가

   | 환경 | 도메인 |
   |------|--------|
   | 로컬 개발 | `http://localhost:5173/*` |
   | Firebase Hosting (프로덕션) | `https://<your-project>.web.app/*` |
   | Firebase Hosting (보조) | `https://<your-project>.firebaseapp.com/*` |

3. **API restrictions** → `Restrict key` 선택 → `YouTube Data API v3`만 체크
4. **Save** 클릭

## 6. .env 파일에 키 추가

프로젝트 루트의 `.env` 파일에 아래 줄을 추가합니다.

```
VITE_YOUTUBE_API_KEY=AIzaSy...
```

이후 개발 서버를 재시작(`npm run dev`)해야 변경 사항이 반영됩니다.

## 7. 쿼터 참고

- 기본 쿼터: **10,000 units/일**
- `videos.list?part=contentDetails` 호출 비용: **1 unit/호출**
- Oh My Scrap은 YouTube URL 스크랩 시 1회만 호출하므로 일반 사용량에서는 쿼터가 충분합니다.
- 쿼터 초과 시 `quotaExceeded` 오류가 발생하며, 길이 확인이 생략됩니다.
