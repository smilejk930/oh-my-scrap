import { getProxyBaseUrl, getAuthHeaders, fetchWithTimeout } from "./scraper";

const ANALYZE_TIMEOUT_MS = 60000;

/**
 * URL의 본문 내용을 Cloudflare Worker(/analyze)를 통해 분석하여 요약본과 태그를 생성합니다.
 * @param {string} content - URL에서 추출된 텍스트 내용 (videoUrl이 있으면 보조 컨텍스트로 활용)
 * @param {string} language - 분석 결과 언어 ('en' or 'ko')
 * @param {string|null} videoUrl - YouTube 영상 URL. 지정 시 Gemini의 비디오 이해 기능으로 영상 자체를 분석.
 * @returns {Promise<{title: string, tags: string[], fullSummary: string}>}
 */
export const analyzeContent = async (content, language = "en", videoUrl = null) => {
  const safeContent = content && content.trim() ? content.substring(0, 5000) : "No content found on this page.";

  try {
    const baseUrl = getProxyBaseUrl();
    const authHeaders = await getAuthHeaders();

    const response = await fetchWithTimeout(
      `${baseUrl}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          content: safeContent,
          language,
          videoUrl,
        }),
      },
      ANALYZE_TIMEOUT_MS
    );

    if (!response.ok) {
      let reason = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error) reason = errBody.error;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(reason);
    }

    const parsed = await response.json();
    if (parsed?.title && Array.isArray(parsed?.tags) && parsed?.fullSummary) {
      return parsed;
    }

    throw new Error("Invalid format returned by AI");
  } catch (error) {
    console.error("Gemini Analysis completely failed:", error);
    return {
      title: "Analysis Failed (Manual entry needed)",
      tags: ["Misc"],
      fullSummary: `Analysis completely failed after retries. Reason: ${error.message?.substring(0, 100) || "Check connection or content."}`
    };
  }
};
