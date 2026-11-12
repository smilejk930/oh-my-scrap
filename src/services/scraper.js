const YT_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_AI_MAX_SECONDS = 180; // 3분 초과 영상은 Gemini 1M 토큰 한도 초과 유발 → AI 분석 생략
const REQUEST_TIMEOUT_MS = 5000;

// AI/비-AI 경로와 무관하게 호스트네임만으로 태그를 강제하고 싶은 사이트.
// 도메인에서 추출한 도메인 파트("Hada")가 사이트의 통용 명칭("GeekNews")과 다른 경우에 사용.
export const FORCED_SITE_TAGS = {
  "news.hada.io": "GeekNews",
};

export const getForcedSiteTag = (url) => {
  try {
    return FORCED_SITE_TAGS[new URL(url).hostname.replace(/^www\./, "")] || null;
  } catch {
    return null;
  }
};

export const generateBasicTags = (url, isYoutubeVideo) => {
  if (isYoutubeVideo) return ["YouTube", "Video"];
  const forced = getForcedSiteTag(url);
  if (forced) return [forced];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const knownDomains = {
      "github.com": "GitHub", "medium.com": "Medium",
      "twitter.com": "Twitter", "x.com": "X",
      "reddit.com": "Reddit", "instagram.com": "Instagram",
      "linkedin.com": "LinkedIn", "notion.so": "Notion",
      "velog.io": "Velog", "tistory.com": "Tistory",
      "naver.com": "Naver",
    };
    const known = knownDomains[hostname];
    if (known) return [known];
    const parts = hostname.split(".");
    const meaningless = new Set(["blog", "www", "app", "m", "news", "shop"]);
    const fallbackIdx = parts.length >= 2 ? parts.length - 2 : 0;
    const domainPart = meaningless.has(parts[0]) ? (parts[1] ?? parts[0]) : parts[fallbackIdx];
    return [domainPart.charAt(0).toUpperCase() + domainPart.slice(1)];
  } catch {
    return ["Web"];
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getGoogleFaviconUrl = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  } catch {
    return "/placeholder.svg";
  }
};

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

const GITHUB_RESERVED_SEGMENTS = new Set([
  "orgs", "topics", "trending", "settings", "search", "explore",
  "marketplace", "sponsors", "notifications", "login", "signup",
  "features", "pricing", "about", "collections", "events",
  "codespaces", "pulls", "issues"
]);

const extractGithubOwnerRepo = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const [owner, rawRepo] = segments;
    if (GITHUB_RESERVED_SEGMENTS.has(owner.toLowerCase())) return null;
    const repo = rawRepo.replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
};

// 1단계 GitHub 저장소 전용 추출기는 저장소 루트(/{owner}/{repo}) 및 브랜치 루트 트리(/{owner}/{repo}/tree/{branch})에만 적용한다.
// /issues/*, /pull/*, /blob/*, /releases/* 등 하위 문서는 2단계로 넘겨 해당 페이지 고유의 제목·본문을 추출한다.
const parseGithubRepoUrl = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const match = u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(?:tree\/[^/]+)?)?\/?$/);
    if (!match) return null;
    const [, owner, repo] = match;
    if (GITHUB_RESERVED_SEGMENTS.has(owner.toLowerCase())) return null;
    return { owner, repo };
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

// CORS 프록시나 리더 API가 Cloudflare 등 봇 차단 인터스티셜에 걸렸을 때 차단 HTML/경고문이 돌아온다.
const isAntiBotInterstitial = (text) => {
  if (!text) return false;
  return /<title>\s*Just a moment\.\.\.?/i.test(text) ||
         /<title>\s*Attention Required!/i.test(text) ||
         /<title>\s*Access Denied/i.test(text) ||
         /__cf_chl_(?:tk|f_tk|opt)/.test(text) ||
         /challenges\.cloudflare\.com/i.test(text) ||
         /cf-browser-verification/i.test(text) ||
         /Warning:\s*Target URL returned error (?:401|403|429|5\d\d)/i.test(text);
};

// 4단계: 모든 본문 추출이 차단/실패했을 때 URL 자체에서 최소 정보를 복원해 저장을 보장한다.
const buildFallbackScrap = (url) => {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const ytMatch = url.match(YT_ID_REGEX);
  const ghRepo = extractGithubOwnerRepo(url);
  const notionTitle = extractNotionPageTitle(url);

  let title = "Untitled";
  if (notionTitle) {
    title = notionTitle;
  } else if (ghRepo) {
    title = `${ghRepo.owner}/${ghRepo.repo}`;
  } else {
    try {
      const u = new URL(url);
      const segments = u.pathname.split("/").filter(Boolean);
      const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "";
      const cleanedSegment = decodeURIComponent(lastSegment)
        .replace(/\.(?:html?|php|aspx?|jsp)$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      title = cleanedSegment || u.hostname.replace(/^www\./, "") || url;
    } catch {
      title = url;
    }
  }

  let thumbnail = getGoogleFaviconUrl(url);
  if (ytMatch?.[1]) {
    thumbnail = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  } else if (ghRepo) {
    thumbnail = `https://opengraph.githubassets.com/1/${ghRepo.owner}/${ghRepo.repo}`;
  }

  return {
    title,
    thumbnail,
    content: title,
    description: "",
    skipAi: true,
    skipReason: "웹페이지 본문 접근이 제한되어 기본 링크 정보로 저장했습니다.",
    isYoutubeVideo: isYoutube
  };
};

// 1단계 (GitHub): 공식 REST API와 HEAD Raw README를 단일 5초 윈도우 내에서 병렬 호출한다.
const scrapeGithubUrl = async (url, { owner, repo }) => {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const rawReadmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;

  const [apiResult, readmeResult] = await Promise.allSettled([
    (async () => {
      const res = await fetchWithTimeout(apiUrl, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
      return res.json();
    })(),
    (async () => {
      const res = await fetchWithTimeout(rawReadmeUrl);
      if (!res.ok) throw new Error(`GitHub Raw README HTTP ${res.status}`);
      const text = await res.text();
      return text.substring(0, 5000);
    })()
  ]);

  const repoData = apiResult.status === "fulfilled" ? apiResult.value : null;
  const readmeText = readmeResult.status === "fulfilled" ? readmeResult.value : "";

  if (!repoData && !readmeText.trim()) {
    return buildFallbackScrap(url);
  }

  const title = repoData?.full_name || `${owner}/${repo}`;
  const description = repoData?.description || "";
  const topicsText = Array.isArray(repoData?.topics) && repoData.topics.length > 0
    ? `Topics: ${repoData.topics.join(", ")}`
    : "";
  const content = [title, description, topicsText, readmeText]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join("\n\n") || title;

  return {
    title,
    thumbnail: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
    content,
    description,
    skipAi: false,
    skipReason: "",
    isYoutubeVideo: false
  };
};

// 2단계: CORS 허용 리더(Jina Reader)와 메타데이터 추출(Microlink) API를 병렬 호출해 결합한다.
const fetchMicrolink = async (url) => {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(apiUrl);
  if (!res.ok) throw new Error(`Microlink HTTP ${res.status}`);
  const json = await res.json();
  if (json?.status !== "success" || !json?.data) {
    throw new Error("Microlink invalid payload");
  }
  const { title, description, image, logo } = json.data;
  if (isAntiBotInterstitial(title) || isAntiBotInterstitial(description)) {
    throw new Error("Microlink anti-bot content");
  }
  return {
    title: title || "",
    description: description || "",
    thumbnail: image?.url || logo?.url || ""
  };
};

const fetchJinaReader = async (url) => {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetchWithTimeout(jinaUrl, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const json = await res.json();
  const d = json?.data || json;
  const title = d?.title || "";
  const description = d?.description || "";
  const content = d?.content || "";
  if (isAntiBotInterstitial(title) || isAntiBotInterstitial(content)) {
    throw new Error("Jina anti-bot interstitial");
  }
  return { title, description, content };
};

const fetchViaExtractorApis = async (url) => {
  const [mlResult, jinaResult] = await Promise.allSettled([
    fetchMicrolink(url),
    fetchJinaReader(url)
  ]);

  const microlink = mlResult.status === "fulfilled" ? mlResult.value : null;
  const jina = jinaResult.status === "fulfilled" ? jinaResult.value : null;

  if (!microlink && !jina) return null;

  const rawTitle = (microlink?.title || jina?.title || "").trim();
  const notionTitle = extractNotionPageTitle(url);
  const isNotionShell = NOTION_SHELL_TITLE_REGEX.test(rawTitle);

  const title = (notionTitle && (!rawTitle || isNotionShell)) ? notionTitle : rawTitle;
  const description = (notionTitle && isNotionShell)
    ? ""
    : (microlink?.description || jina?.description || "").trim();
  const bodyText = (jina?.content || "").replace(/\s+/g, " ").trim().substring(0, 5000);
  const thumbnail = microlink?.thumbnail || getGoogleFaviconUrl(url);

  const isValid = Boolean(
    title &&
    title !== "Untitled" &&
    !NOTION_SHELL_TITLE_REGEX.test(title) &&
    (description.length > 0 || bodyText.length > 0)
  );

  if (!isValid) return null;

  const content = [title, description, bodyText]
    .map((s) => (s || "").trim())
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
};

// 3단계: 정비된 CORS 프록시(CodeTabs, AllOrigins)를 5초 타임아웃의 Promise.any로 병렬 경쟁 호출한다.
const fetchViaCodeTabs = async (target) => {
  const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`;
  const response = await fetchWithTimeout(proxyUrl);
  if (!response.ok) throw new Error(`CodeTabs HTTP ${response.status}`);
  const text = await response.text();
  if (!text || !text.trim() || isAntiBotInterstitial(text)) {
    throw new Error("CodeTabs empty or anti-bot interstitial");
  }
  return text;
};

const fetchViaAllOrigins = async (target) => {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
  const response = await fetchWithTimeout(proxyUrl);
  if (!response.ok) throw new Error(`AllOrigins HTTP ${response.status}`);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("AllOrigins invalid JSON");
  }
  const html = data?.contents;
  if (!html || !html.trim() || isAntiBotInterstitial(html)) {
    throw new Error("AllOrigins empty or anti-bot interstitial");
  }
  return html;
};

const fetchHtmlViaProxies = async (url) => {
  const rewritten = rewriteHostForFetch(url);
  const targets = rewritten !== url ? [rewritten, url] : [url];
  const tasks = [];
  for (const target of targets) {
    tasks.push(fetchViaCodeTabs(target));
    tasks.push(fetchViaAllOrigins(target));
  }
  return Promise.any(tasks);
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
    const res = await fetchWithTimeout(apiUrl);
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
 * @param {{ checkDuration?: boolean }} [options]
 * @returns {Promise<{title: string, thumbnail: string, content: string, description: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean}>}
 */
export const scrapeUrl = async (url, { checkDuration = true } = {}) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid URL format.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Invalid URL protocol.");
  }

  try {
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

    // 1단계 A: YouTube (oEmbed + Data API v3 영상 길이 확인)
    if (isYoutube) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetchWithTimeout(oembedUrl);
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
          thumbnail: data.thumbnail_url || getGoogleFaviconUrl(url),
          content: `Title: ${ytTitle}\nChannel: ${ytChannel}`,
          description: ytChannel ? `Channel: ${ytChannel}` : "",
          skipAi,
          skipReason,
          isYoutubeVideo: true
        };
      } catch (ytErr) {
        console.warn("[scrapeUrl] YouTube oEmbed failed, falling back to basic info:", ytErr.message);
        return buildFallbackScrap(url);
      }
    }

    // 1단계 B: GitHub 저장소 루트 / 브랜치 트리 전용 추출기
    const githubRepo = parseGithubRepoUrl(url);
    if (githubRepo) {
      return await scrapeGithubUrl(url, githubRepo);
    }

    // 2단계: CORS 허용 리더/메타데이터 추출 API 병렬 호출 (Jina Reader + Microlink)
    try {
      const extracted = await fetchViaExtractorApis(url);
      if (extracted) return extracted;
    } catch (extErr) {
      console.warn("[scrapeUrl] Stage 2 extractor APIs failed:", extErr.message);
    }

    // 3단계: 정비된 CORS 프록시 병렬 경쟁 호출 + DOMParser 파싱
    const html = await fetchHtmlViaProxies(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property) =>
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const rawMetaTitle = getMeta("og:title") || doc.title?.trim() || "";
    let title = rawMetaTitle || "Untitled";
    let description = (getMeta("og:description") || getMeta("description") || "").trim();

    // Notion publish 페이지는 본문/메타가 SSR되지 않아 "Notion | Where teams..." 마케팅 셸이 잡힌다.
    // URL slug에서 페이지 제목을 복원하고, 마케팅 description은 제거해 AI가 셸에 휘둘리지 않게 한다.
    const notionPageTitle = extractNotionPageTitle(url);
    if (notionPageTitle && NOTION_SHELL_TITLE_REGEX.test(title)) {
      title = notionPageTitle;
      description = "";
    }

    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map((el) => el.innerText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // 빈 셸이거나 복원 불가능한 Notion 마케팅 셸이면 4단계 최소 정보 폴백으로 전환
    if ((!rawMetaTitle && !description && !bodyText) || (NOTION_SHELL_TITLE_REGEX.test(title) && !notionPageTitle)) {
      return buildFallbackScrap(url);
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
          thumbnail = getGoogleFaviconUrl(url);
        }
      } else {
        thumbnail = getGoogleFaviconUrl(url);
      }
    }

    // Notion 같은 SPA는 본문이 JS로 렌더되어 og:title/description만 남는다.
    // 메타 정보를 항상 앞에 붙여서 빈약한 본문에도 AI가 최소 신호를 얻도록 한다.
    const content = [title, description, bodyText]
      .map((s) => (s || "").trim())
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
    console.warn("[scrapeUrl] All extraction stages failed, using minimal URL fallback:", error);
    return buildFallbackScrap(url);
  }
};
