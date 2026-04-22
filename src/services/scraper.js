/**
 * URL에서 메타데이터(제목, 썸네일) 및 본문 텍스트를 추출합니다.
 * @param {string} url - 스크랩할 대상 URL
 * @returns {Promise<{title: string, thumbnail: string, content: string, isYoutubeVideo: boolean}>}
 */
export const scrapeUrl = async (url) => {
  try {
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

    // YouTube는 CORS 프록시가 reCAPTCHA/동의 페이지에 막혀 본문 추출이 불가능. oEmbed로 메타데이터만 가져오고 영상 내용 분석은 Gemini의 비디오 이해 기능(gemini.js)에 위임한다.
    if (isYoutube) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oembedUrl);
      if (!response.ok) throw new Error(`YouTube oEmbed failed: HTTP ${response.status}`);
      const data = await response.json();
      const ytTitle = data.title || "Untitled";
      const ytChannel = data.author_name || "";

      return {
        title: ytTitle,
        thumbnail: data.thumbnail_url || "",
        content: `Title: ${ytTitle}\nChannel: ${ytChannel}`,
        isYoutubeVideo: true
      };
    }

    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let html = null;
    let lastError = null;

    for (const proxyUrl of proxies) {
      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        html = await response.text();
        break; // 성공 시 루프 중단
      } catch (e) {
        lastError = e;
        continue; // 실패 시 다음 프록시 시도
      }
    }

    // 만약 앞의 프록시들이 모두 실패했다면 마지막으로 allorigins.win 시도 (JSON 응답)
    if (!html) {
      const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(allOriginsUrl);
      const data = await response.json();
      if (!data.contents) throw lastError || new Error("All proxies failed");
      html = data.contents;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property) =>
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const title = getMeta("og:title") || doc.title || "Untitled";
    const thumbnail = getMeta("og:image") || "";

    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map(el => el.innerText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title,
      thumbnail,
      content: bodyText || title,
      isYoutubeVideo: false
    };
  } catch (error) {
    console.error("Scraping Error:", error);
    throw new Error("Failed to fetch URL information.");
  }
};
