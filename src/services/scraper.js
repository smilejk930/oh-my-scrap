/**
 * URL에서 메타데이터(제목, 썸네일) 및 본문 텍스트를 추출합니다.
 * @param {string} url - 스크랩할 대상 URL
 * @returns {Promise<{title: string, thumbnail: string, content: string}>}
 */
export const scrapeUrl = async (url) => {
  try {
    // AllOrigins CORS Proxy 사용
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (!data.contents) throw new Error("Could not fetch page content");

    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, "text/html");

    // 메타데이터 추출
    const getMeta = (property) => 
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const title = getMeta("og:title") || doc.title || "제목 없음";
    const thumbnail = getMeta("og:image") || "";
    
    // 본문 텍스트 추출 (주요 태그 위주)
    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map(el => el.innerText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title,
      thumbnail,
      content: bodyText || title
    };
  } catch (error) {
    console.error("Scraping Error:", error);
    throw new Error("URL 정보를 가져오는데 실패했습니다.");
  }
};
