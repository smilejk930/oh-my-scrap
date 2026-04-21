# Implementation Plan - Global Translation (English)

This plan outlines the steps to translate all user-facing UI elements from Korean to English to support global users, while preserving source code comments.

## Proposed Changes

### UI Components

#### [MODIFY] [App.jsx](file:///d:/develop/workspace/oh-my-scrap/src/App.jsx)
- Update sidebar and navigation items: "스크랩 추가" -> "Add Scrap", "내 보관함" -> "My Library".
- Update footer buttons: "개인 식별자 (UID) 복사" -> "Copy Personal UID", "로그아웃" -> "Sign Out".
- Update mobile header and bottom navigation labels.
- Update login screen alerts and messages.

#### [MODIFY] [InputSection.jsx](file:///d:/develop/workspace/oh-my-scrap/src/components/InputSection.jsx)
- Update status messages: "URL 정보를 가져오는 중..." -> "Fetching URL info...", "AI가 내용을 분석하는 중..." -> "AI is analyzing content...", "분석 완료!" -> "Analysis complete!".
- Update form labels and placeholders: "스크랩할 URL 입력" -> "Enter URL to scrap".
- Update success message: "저장되었습니다!" -> "Saved successfully!".

#### [MODIFY] [ScrapList.jsx](file:///d:/develop/workspace/oh-my-scrap/src/components/ScrapList.jsx)
- Update loading state: "불러오는 중..." -> "Loading...".
- Update search placeholder and filter labels: "스크랩 검색..." -> "Search scraps...", "전체" -> "All", "오늘" -> "Today", "일주일" -> "Week", "한달" -> "Month", "한달 이후" -> "Older".
- Update empty state: "데이터가 없습니다." -> "No scraps found.".
- Update detail view text: "분석되지 않은 스크랩" -> "Unanalyzed Scrap", "요약 정보가 없습니다." -> "No summary available.", "원문 보기" -> "View Original", "삭제하기" -> "Delete".
- Update confirmation dialogs and alerts.

#### [MODIFY] [ScrapItem.jsx](file:///d:/develop/workspace/oh-my-scrap/src/components/ScrapItem.jsx)
- Update relative time: "방금 전" -> "Just now".
- Update AI analysis button: "AI 분석하기" -> "Analyze with AI", "분석 중..." -> "Analyzing...".
- Update delete confirmation and error alerts.

### Services

#### [MODIFY] [scraper.js](file:///d:/develop/workspace/oh-my-scrap/src/services/scraper.js)
- Update default title: "제목 없음" -> "Untitled".
- Update error messages thrown for URL fetching.

#### [MODIFY] [gemini.js](file:///d:/develop/workspace/oh-my-scrap/src/services/gemini.js)
- **CRITICAL**: Update the AI prompt to request analysis in English.
- Update the prompt constraints: "title은 반드시 영문 기준 40자 이내" (title within 40 chars in English) instead of 20 chars in Korean.
- Update fallback/failure values: "Analysis failed", "Misc", "Summary unavailable".

## Verification Plan

### Automated/Manual Verification
- I will verify the UI by reviewing the code changes to ensure no Korean strings remain in the JSX.
- I will check the AI prompt logic specifically to ensure it explicitly asks for English output.
- I will verify that the date formatting and status messages are naturally phrased in English.
