import { getProxyBaseUrl, getAuthHeaders, fetchWithTimeout } from "./scraper";

const ANALYZE_TIMEOUT_MS = 60000;
const ASK_TIMEOUT_MS = 35000;

/**
 * URL의 본문 내용을 Cloudflare Worker(/analyze)를 통해 분석하여 요약본과 태그를 생성합니다.
 * @param {string} content - URL에서 추출된 텍스트 내용 (videoUrl이 있으면 보조 컨텍스트로 활용)
 * @param {string} language - 분석 결과 언어 ('en' or 'ko')
 * @param {string|null} videoUrl - YouTube 영상 URL. 지정 시 Gemini의 비디오 이해 기능으로 영상 자체를 분석.
 * @param {{ contentTypeHint?: string | null }} [options]
 * @returns {Promise<{title: string, tags: string[], contentType: string, fullSummary: string}>}
 */
export const analyzeContent = async (content, language = "en", videoUrl = null, options = {}) => {
  const safeContent = content && content.trim() ? content.substring(0, 12000) : "No content found on this page.";

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
          contentTypeHint: options?.contentTypeHint || null,
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
      return {
        title: parsed.title,
        tags: parsed.tags,
        contentType: parsed.contentType || (videoUrl ? "video" : "general"),
        fullSummary: parsed.fullSummary,
      };
    }

    throw new Error("Invalid format returned by AI");
  } catch (error) {
    console.error("Gemini Analysis completely failed:", error);
    return {
      title: "Analysis Failed (Manual entry needed)",
      tags: ["Misc"],
      contentType: "general",
      fullSummary: `Analysis completely failed after retries. Reason: ${error.message?.substring(0, 100) || "Check connection or content."}`
    };
  }
};

/**
 * 저장된 내 보관함 스크랩들을 컨텍스트로 Cloudflare Worker(/ask)에 자연어 질문을 보냅니다.
 * @param {string} question
 * @param {Array} scraps
 * @param {string} language
 * @returns {Promise<{answer: string, matchedIds: string[], followUpSuggestions: string[]}>}
 */
export const askMyScraps = async (question, scraps = [], language = "en") => {
  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  if (!cleanQuestion) {
    throw new Error("Please enter a question.");
  }

  // 질문 토큰과 일치하는 스크랩에 가중치를 부여하고 최신 항목을 함께 포함해 최대 120개 선별
  const tokens = cleanQuestion
    .toLowerCase()
    .split(/[\s,?.!]+/)
    .filter((t) => t.length >= 2);

  const scored = scraps.map((scrap, idx) => {
    const haystack = [
      scrap.title,
      ...(Array.isArray(scrap.tags) ? scrap.tags : []),
      scrap.fullSummary,
      scrap.userNote,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let hits = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) hits++;
    }
    return { scrap, hits, idx };
  });

  scored.sort((a, b) => b.hits - a.hits || a.idx - b.idx);
  const selected = scored.slice(0, 120).map(({ scrap }) => {
    const createdAt = scrap.createdAt?.toDate ? scrap.createdAt.toDate() : null;
    return {
      id: scrap.id,
      title: scrap.title || "Untitled",
      tags: Array.isArray(scrap.tags) ? scrap.tags.slice(0, 5) : [],
      summary: (scrap.fullSummary || "").slice(0, 350),
      userNote: (scrap.userNote || "").slice(0, 150),
      contentType: scrap.contentType || "general",
      date: createdAt ? createdAt.toISOString().slice(0, 10) : "",
    };
  });

  const baseUrl = getProxyBaseUrl();
  const authHeaders = await getAuthHeaders();

  const response = await fetchWithTimeout(
    `${baseUrl}/ask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        question: cleanQuestion,
        language,
        scraps: selected,
      }),
    },
    ASK_TIMEOUT_MS
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

  const data = await response.json();
  if (typeof data?.answer !== "string") {
    throw new Error("Invalid response from Ask AI.");
  }

  return {
    answer: data.answer,
    matchedIds: Array.isArray(data.matchedIds) ? data.matchedIds : [],
    followUpSuggestions: Array.isArray(data.followUpSuggestions) ? data.followUpSuggestions : [],
  };
};
