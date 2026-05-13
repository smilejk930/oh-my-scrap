const YT_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_AI_MAX_SECONDS = 180; // 3분 초과 영상은 Gemini 1M 토큰 한도 초과 유발 → AI 분석 생략

// Notion publish 페이지(*.notion.site)는 본문이 JS로만 렌더링되어 프록시 HTML에는
// "Notion | Where teams..." 같은 마케팅 셸 메타만 남는다. URL slug의 마지막 32자 hex가
// page id이고 그 앞이 dash로 연결된 페이지 제목이라 이를 복원해 사용한다.
const NOTION_PAGE_ID_REGEX = /-?[0-9a-f]{32}$/i;
const NOTION_SHELL_TITLE_REGEX = /^Notion\s*\|/i;

const extractNotionPageTitle = (url) => {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".notion.site")) return null;
    const segment = u.pathname.split("/").filter(Boolean).pop() || "";
    const withoutId = segment.replace(NOTION_PAGE_ID_REGEX, "");
    if (!withoutId) return null;
    return decodeURIComponent(withoutId).replace(/-/g, " ").trim() || null;
  } catch {
    return null;
  }
};

// 일부 사이트는 SPA 셸을 내려보내 og:title 외엔 본문이 비어 있다.
// 프록시 fetch 단계에서만 도메인을 SSR 친화 호스트로 바꿔치기하고 저장되는 URL은 그대로 유지한다.
const rewriteHostForFetch = (url) => {
  try {
    const u = new URL(url);
    // *.reddit.com → old.reddit.com (게시글/댓글 본문을 정적 HTML로 내려준다)
    if (u.hostname === "reddit.com" || u.hostname.endsWith(".reddit.com")) {
      if (u.hostname !== "old.reddit.com") {
        u.hostname = "old.reddit.com";
        return u.toString();
      }
    }
  } catch {
    // URL 파싱 실패 시 원본 그대로 사용
  }
  return url;
};

// CORS 프록시가 Cloudflare 등 봇 차단 인터스티셜에 걸렸을 때 HTTP 200으로 챌린지 HTML이 돌아온다.
// 이 페이지는 og:title이 없고 <title>이 "Just a moment..."라서 그대로 진행하면 Gemini가 그걸 본문으로 요약해버린다.
const isAntiBotInterstitial = (html) => {
  if (!html) return false;
  return /<title>\s*Just a moment\.\.\.?/i.test(html) ||
         /__cf_chl_(?:tk|f_tk|opt)/.test(html) ||
         /challenges\.cloudflare\.com/i.test(html) ||
         /cf-browser-verification/i.test(html);
};

// 여러 CORS 프록시를 순차 시도해 HTML 본문을 가져온다.
// allorigins는 JSON 래퍼를 쓰므로 마지막 폴백으로 분리.
const fetchHtmlViaProxies = async (target) => {
  const proxies = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?${encodeURIComponent(target)}`
  ];

  let lastError = null;
  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (isAntiBotInterstitial(text)) throw new Error("Anti-bot interstitial");
      return text;
    } catch (e) {
      lastError = e;
    }
  }

  const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
  const response = await fetch(allOriginsUrl);
  const data = await response.json();
  if (!data.contents) throw lastError || new Error("All proxies failed");
  if (isAntiBotInterstitial(data.contents)) {
    throw lastError || new Error("All proxies returned an anti-bot interstitial");
  }
  return data.contents;
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

    const fetchUrl = rewriteHostForFetch(url);
    let html;
    try {
      html = await fetchHtmlViaProxies(fetchUrl);
    } catch (e) {
      // rewrite한 호스트(old.reddit.com 등)가 프록시 측에서 막혔을 때는 원본 URL로 한 번 더 시도.
      if (fetchUrl !== url) {
        console.warn(`[scrapeUrl] rewrite fetch failed (${fetchUrl}); retrying original:`, e.message);
        html = await fetchHtmlViaProxies(url);
      } else {
        throw e;
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property) =>
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    let title = getMeta("og:title") || doc.title || "Untitled";
    let description = getMeta("og:description") || getMeta("description") || "";

    // Notion publish 페이지는 본문/메타가 SSR되지 않아 "Notion | Where teams..." 마케팅 셸이 잡힌다.
    // URL slug에서 페이지 제목을 복원하고, 마케팅 description은 제거해 AI가 셸에 휘둘리지 않게 한다.
    const notionPageTitle = extractNotionPageTitle(url);
    if (notionPageTitle && NOTION_SHELL_TITLE_REGEX.test(title)) {
      title = notionPageTitle;
      description = "";
    }

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

    // Notion 같은 SPA는 본문이 JS로 렌더되어 og:title/description만 남는다.
    // 메타 정보를 항상 앞에 붙여서 빈약한 본문에도 AI가 최소 신호를 얻도록 한다.
    const content = [title, description, bodyText]
      .map(s => (s || "").trim())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .join("\n\n") || title;

    return {
      title,
      thumbnail,
      content,
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
