/**
 * URL에서 메타데이터(제목, 썸네일) 및 본문 텍스트를 추출합니다.
 * @param {string} url - 스크랩할 대상 URL
 * @returns {Promise<{title: string, thumbnail: string, content: string, skipAi: boolean, skipReason: string}>}
 */
export const scrapeUrl = async (url) => {
  try {
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

    // 메타데이터 추출
    const getMeta = (property) => 
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const title = getMeta("og:title") || doc.title || "Untitled";
    const thumbnail = getMeta("og:image") || "";

    // 유튜브 영상 분기 처리: 5분(300초) 이상이면 AI 생략 처리
    let skipAi = false;
    let skipReason = "";
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
      if (lengthMatch) {
        const durationSeconds = parseInt(lengthMatch[1], 10);
        if (durationSeconds > 300) {
          skipAi = true;
          skipReason = "재생 시간이 5분을 초과하는 유튜브 영상은 AI 요약이 생략됩니다.";
        }
      } else {
         // 쇼츠나 실시간 스트리밍의 경우 시간이 없거나 다를 수 있음
         // 이 코드 위치에서 추가 처리 필요 유무 판별 가능
      }
    }
    
    // 본문 텍스트 추출 (주요 태그 위주)
    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map(el => el.innerText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title,
      thumbnail,
      content: bodyText || title,
      skipAi,
      skipReason
    };
  } catch (error) {
    console.error("Scraping Error:", error);
    throw new Error("Failed to fetch URL information.");
  }
};
