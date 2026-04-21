import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const generateWithRetry = async (prompt, retries = 3) => {
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
  let lastError;

  for (let i = 0; i < retries; i++) {
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return await result.response;
      } catch (error) {
        lastError = error;
        // 503(과부하)이나 429(속도제한) 에러 시 대기 후 재시도
        if (error.message?.includes("503") || error.message?.includes("429")) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } 
        // 404 모델 없음 에러는 바로 다음 모델 시도
        else if (error.message?.includes("404")) {
          continue; 
        } else {
          // 기타 에러 시에는 다음 모델 시도
          break;
        }
      }
    }
  }
  throw lastError;
};

/**
 * URL의 본문 내용을 분석하여 요약본과 태그를 생성합니다.
 * @param {string} content - URL에서 추출된 텍스트 내용
 * @returns {Promise<{title: string, tags: string[], fullSummary: string}>}
 */
export const analyzeContent = async (content) => {
  try {
    const prompt = `
      다음 웹페이지 내용을 분석해서 다음 형식의 JSON으로 반환해줘. 
      내용: ${content.substring(0, 5000)} // 최대 5000자만 분석
      
      형식:
      {
        "title": "20자 이내의 대표 문구",
        "tags": ["태그1", "태그2", "태그3"], // 최대 3개
        "fullSummary": "페이지의 핵심 내용을 2~3문장으로 요약"
      }
      
      주의사항:
      - title은 반드시 한국어 기준 20자 이내로 매우 직관적으로 작성할 것.
      - JSON 형식만 반환할 것.
    `;

    const response = await generateWithRetry(prompt);
    const text = response.text();
    
    // JSON 추출 (코드 블럭 제거 등)
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Invalid Gemini response format");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      title: "분석 실패 (직접 입력 필요)",
      tags: ["기타"],
      fullSummary: "요약을 생성할 수 없습니다."
    };
  }
};
