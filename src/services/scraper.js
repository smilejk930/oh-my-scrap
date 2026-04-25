const YT_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_AI_MAX_SECONDS = 180; // 3분 초과 영상은 Gemini 1M 토큰 한도 초과 유발 → AI 분석 생략

// CORS 프록시가 Cloudflare 등 봇 차단 인터스티셜에 걸렸을 때 HTTP 200으로 챌린지 HTML이 돌아온다.
// 이 페이지는 og:title이 없고 <title>이 "Just a moment..."라서 그대로 진행하면 Gemini가 그걸 본문으로 요약해버린다.
const isAntiBotInterstitial = (html) => {
  if (!html) return false;
  return /<title>\s*Just a moment\.\.\.?/i.test(html) ||
         /__cf_chl_(?:tk|f_tk|opt)/.test(html) ||
         /challenges\.cloudflare\.com/i.test(html) ||
         /cf-browser-verification/i.test(html);
};

// ISO 8601 duration (e.g. "PT1H2M3S") → seconds
const parseIsoDuration = (iso) => {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h, mi, s] = m;
  return (Number(h) || 0) * 3600 + (Number(mi) || 0) * 60 + (Number(s) || 0);
};

const fetchYoutubeDurationSeconds = async (videoId) => {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("VITE_YOUTUBE_API_KEY not set — YouTube duration check skipped. Long videos may exceed Gemini token limit.");
    return null;
  }
  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.warn(`YouTube Data API failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return parseIsoDuration(data?.items?.[0]?.contentDetails?.duration);
  } catch (e) {
    console.warn("YouTube duration fetch error:", e.message);
    return null;
  }
};

/**
 * URL에서 메타데이터(제목, 썸네일) 및 본문 텍스트를 추출합니다.
 * @param {string} url - 스크랩할 대상 URL
 * @returns {Promise<{title: string, thumbnail: string, content: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean}>}
 */
export const scrapeUrl = async (url, { checkDuration = true } = {}) => {
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

      // 3분 초과 영상은 AI 분석 생략 (토큰 한도 초과 방지 + 비용 절감)
      const idMatch = url.match(YT_ID_REGEX);
      const videoId = idMatch ? idMatch[1] : null;
      let skipAi = false;
      let skipReason = "";
      if (checkDuration && videoId) {
        const seconds = await fetchYoutubeDurationSeconds(videoId);
        if (seconds !== null && seconds > YOUTUBE_AI_MAX_SECONDS) {
          skipAi = true;
          const mm = Math.floor(seconds / 60);
          const ss = seconds % 60;
          skipReason = `3분 초과 영상(${mm}분 ${ss}초)으로 AI 분석을 생략했습니다.`;
        }
      }

      return {
        title: ytTitle,
        thumbnail: data.thumbnail_url || "",
        content: `Title: ${ytTitle}\nChannel: ${ytChannel}`,
        description: ytChannel ? `Channel: ${ytChannel}` : "",
        skipAi,
        skipReason,
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
        const text = await response.text();
        // Cloudflare 등 봇 차단 인터스티셜은 HTTP 200으로 오기 때문에 본문을 검사해 폴백시킨다.
        if (isAntiBotInterstitial(text)) throw new Error("Anti-bot interstitial");
        html = text;
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
      if (isAntiBotInterstitial(data.contents)) {
        throw lastError || new Error("All proxies returned an anti-bot interstitial");
      }
      html = data.contents;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property) =>
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const title = getMeta("og:title") || doc.title || "Untitled";
    const description = getMeta("og:description") || getMeta("description") || "";

    const ogImage = getMeta("og:image");
    let thumbnail = ogImage;
    if (!thumbnail) {
      const iconEl =
        doc.querySelector('link[rel="apple-touch-icon"]') ||
        doc.querySelector('link[rel="icon"][type="image/png"]') ||
        doc.querySelector('link[rel="icon"]') ||
        doc.querySelector('link[rel="shortcut icon"]');
      const href = iconEl?.getAttribute("href") || "";
      if (href) {
        try {
          thumbnail = href.startsWith("http") ? href : new URL(href, url).href;
        } catch {
          thumbnail = "/placeholder.svg";
        }
      } else {
        thumbnail = "/placeholder.svg";
      }
    }

    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map(el => el.innerText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title,
      thumbnail,
      content: bodyText || title,
      description,
      skipAi: false,
      skipReason: "",
      isYoutubeVideo: false
    };
  } catch (error) {
    console.error("Scraping Error:", error);
    throw new Error("Failed to fetch URL information.");
  }
};
