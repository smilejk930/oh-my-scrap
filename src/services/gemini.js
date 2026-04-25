import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

/**
 * URL의 본문 내용을 분석하여 요약본과 태그를 생성합니다.
 * @param {string} content - URL에서 추출된 텍스트 내용 (videoUrl이 있으면 보조 컨텍스트로 활용)
 * @param {string} language - 분석 결과 언어 ('en' or 'ko')
 * @param {string|null} videoUrl - YouTube 영상 URL. 지정 시 Gemini의 비디오 이해 기능으로 영상 자체를 분석.
 * @returns {Promise<{title: string, tags: string[], fullSummary: string}>}
 */
export const analyzeContent = async (content, language = "en", videoUrl = null) => {
  const isKorean = language === "ko";

  // 분석할 내용 본문 정제
  const safeContent = content && content.trim() ? content.substring(0, 5000) : "No content found on this page.";

  const subject = videoUrl
    ? `the following YouTube video (additional metadata: ${safeContent})`
    : `the following webpage content.\nContent: ${safeContent}`;

  const recipeFullSummaryFormat = isKorean
    ? `음식/요리 레시피 콘텐츠일 경우 아래 형식의 일반 텍스트로 작성하세요(마크다운 금지, 줄바꿈은 \\n 사용):
        [요리 소개]
        한두 문장으로 어떤 요리인지 간단히 소개합니다.

        [재료]
        - 재료1: 분량
        - 재료2: 분량
        ...

        [만드는 법]
        1. 첫 번째 단계
        2. 두 번째 단계
        ...
       콘텐츠에 명시되지 않은 재료/단계는 임의로 만들지 말고, 본문에 등장한 정보만 사용해 정리하세요. 분량이 명시되지 않은 재료는 '적당량'으로 표기하세요.`
    : `If the content is a food/cooking recipe, write it as plain text (no markdown, use \\n for line breaks) in this exact structure:
        [About]
        One or two sentences describing the dish.

        [Ingredients]
        - ingredient 1: amount
        - ingredient 2: amount
        ...

        [Instructions]
        1. First step
        2. Second step
        ...
       Do not invent ingredients or steps that are not in the source content; if an amount is missing, write 'to taste'.`;

  const prompt = `
    Analyze ${subject} and return it in JSON format.

    Format:
    {
      "title": "A punchy headline within 40 characters",
      "tags": ["tag1", "tag2", "tag3"], // Up to 3 tags
      "fullSummary": "See rules below"
    }

    Requirements:
    - The 'title' must be very intuitive and within 40 characters.
    - Return ONLY the JSON object.
    - All output (title, tags, fullSummary) must be in ${isKorean ? "Korean (한국어)" : "English"}.
    - ${isKorean ? "태그는 사회적으로 통용되는 검색하기 쉬운 키워드 위주로 작성하세요." : "Tags should be common searchable keywords."}

    fullSummary rules:
    - First, decide whether the content is primarily a food/cooking recipe (e.g., describes a dish along with how to make it, ingredients, or cooking steps).
    - If it IS a recipe: ${recipeFullSummaryFormat}
    - If it is NOT a recipe: summarize the core content in 2-3 sentences as plain prose.
    - When the content is a recipe, also include "${isKorean ? "레시피" : "Recipe"}" as one of the tags.
  `;

  // YouTube URL은 Gemini API가 정규 형식(youtube.com/watch?v=ID)만 인식하므로 youtu.be/공유 파라미터 등을 정리
  const normalizedVideoUrl = videoUrl
    ? (() => {
        const m = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? `https://www.youtube.com/watch?v=${m[1]}` : videoUrl;
      })()
    : null;

  // 비디오 입력이 필요할 땐 비디오 미지원 가능성이 있는 flash-lite/preview 모델은 제외하여 불필요한 재시도를 줄임
  // gemini-2.0-flash는 신규 사용자에게 404를 반환하므로 제외
  const modelsToTry = normalizedVideoUrl
    ? ["gemini-2.5-flash", "gemini-2.5-pro"]
    : ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3.1-pro-preview"];
  const maxRetriesPerModel = 3;

  let lastError = new Error("Initialization");

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          // Gemini JSON 응답 모드 강제
          generationConfig: { responseMimeType: "application/json" }
        });

        // YouTube URL은 mimeType을 명시하면 400 에러가 나므로 fileUri만 전달 (API가 자동 감지)
        const requestParts = normalizedVideoUrl
          ? [{ fileData: { fileUri: normalizedVideoUrl } }, { text: prompt }]
          : prompt;

        const result = await model.generateContent(requestParts);
        const response = await result.response;
        const text = response.text();

        // JSON 추출
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // 예상한 결과 값들이 존재하는지 검증
          if (parsed.title && parsed.tags && parsed.fullSummary) {
            return parsed; // 파싱 성공 및 형식 일치 시 즉시 반환
          }
        }

        throw new Error("Invalid format returned by AI");
      } catch (error) {
        lastError = error;
        console.warn(`[${modelName} - Attempt ${attempt}] failed:`, error.message);

        // 429(속도제한)는 잠시 후 회복 가능 → 백오프 대기 후 같은 모델 재시도
        if (error.message?.includes("429")) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        // 503(모델 과부하)이나 404(모델 없음)는 같은 모델 재시도해도 회복 가능성 낮음 → 즉시 다음 모델로
        else if (error.message?.includes("503") || error.message?.includes("404")) {
          break;
        }
        // 기타 파싱/형식 에러 등의 경우 남은 횟수만큼 동일 모델에서 계속 재시도
      }
    }
  }

  // 모든 모델에서의 시도가 실패한 경우
  console.error("Gemini Analysis completely failed:", lastError);
  return {
    title: "Analysis Failed (Manual entry needed)",
    tags: ["Misc"],
    fullSummary: `Analysis completely failed after retries. Reason: ${lastError.message?.substring(0, 100) || "Check connection or content."}`
  };
};
