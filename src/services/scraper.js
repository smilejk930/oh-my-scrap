import { auth } from "../firebase/firebase";
import { translate } from "../i18n/translations";

const YT_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_AI_MAX_SECONDS = 180; // 3분 초과 영상은 자막(Transcript) 추출 기반 분석으로 전환
const YOUTUBE_MULTIMODAL_FALLBACK_MAX_SECONDS = 1200; // 20분 이하 영상은 자막 추출 실패 시 저해상도 멀티모달 분석 폴백
const REQUEST_TIMEOUT_MS = 5000;
const TRANSCRIPT_TIMEOUT_MS = 18000;
const DEFAULT_CUSTOM_PROXY_URL = "https://oh-my-scrap-proxy.smilejk930.workers.dev";
const TRACKING_QUERY_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid",
  "si", "igshid", "ref", "ref_src", "feature", "s", "spm",
]);

export const extractYoutubeVideoId = (url) => {
  if (!url || typeof url !== "string") return null;
  const match = url.match(YT_ID_REGEX);
  return match ? match[1] : null;
};

export const extractFirstUrl = (text) => {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  let candidate = match[0].replace(/[.,!?;:'"<>]+$/, "");
  if (candidate.endsWith(")") && !candidate.includes("(")) {
    candidate = candidate.slice(0, -1);
  }
  return sanitizeHttpUrl(candidate);
};

export const normalizeUrlForDedup = (rawUrl) => {
  const safe = sanitizeHttpUrl(rawUrl);
  if (!safe) return null;

  const ytId = extractYoutubeVideoId(safe);
  if (ytId) {
    return `https://www.youtube.com/watch?v=${ytId}`;
  }

  try {
    const u = new URL(safe);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const cleanParams = [];
    for (const [key, val] of u.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(lowerKey)) {
        continue;
      }
      cleanParams.push([key, val]);
    }
    cleanParams.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const search = cleanParams.length > 0
      ? `?${new URLSearchParams(cleanParams).toString()}`
      : "";
    const pathname = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
    const hash = u.hash && u.hash.startsWith("#/") ? u.hash : "";
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}${pathname}${search}${hash}`;
  } catch {
    return safe;
  }
};

export const getProxyBaseUrl = () =>
  (import.meta.env.VITE_SCRAPE_PROXY_URL || DEFAULT_CUSTOM_PROXY_URL).trim().replace(/\/+$/, "");

export const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const sanitizeHttpUrl = (rawUrl, baseUrl = undefined) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
};

export const openSafeUrl = (rawUrl) => {
  const safeUrl = sanitizeHttpUrl(rawUrl);
  if (!safeUrl) {
    console.warn("[openSafeUrl] Blocked unsafe URL:", rawUrl);
    return;
  }
  window.open(safeUrl, "_blank", "noopener,noreferrer");
};

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

export const applyRequiredTags = (tags = [], url, isYoutubeVideo = false) => {
  const result = [];
  const seen = new Set();
  const pushUnique = (tag) => {
    const clean = typeof tag === "string" ? tag.trim() : "";
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  const forcedTag = getForcedSiteTag(url);
  if (forcedTag) pushUnique(forcedTag);
  if (isYoutubeVideo) pushUnique("YouTube");
  for (const tag of Array.isArray(tags) ? tags : []) {
    pushUnique(tag);
  }
  return result.slice(0, 3);
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

export const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
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

// 프록시 응답이 Cloudflare 등 봇 차단 인터스티셜에 걸렸을 때 차단 HTML이 돌아오는지 판별한다.
const isAntiBotInterstitial = (text) => {
  if (!text) return false;
  return /<title>\s*Just a moment\.\.\.?/i.test(text) ||
         /<title>\s*Attention Required!/i.test(text) ||
         /<title>\s*Access Denied/i.test(text) ||
         /__cf_chl_(?:tk|f_tk|opt)/.test(text) ||
         /challenges\.cloudflare\.com/i.test(text) ||
         /cf-browser-verification/i.test(text);
};

// 3단계: 모든 본문 추출이 차단/실패했을 때 URL 자체에서 최소 정보를 복원해 저장을 보장한다.
const buildFallbackScrap = (url, language = "en") => {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const ytMatch = url.match(YT_ID_REGEX);
  const ghRepo = extractGithubOwnerRepo(url);
  const notionTitle = extractNotionPageTitle(url);

  let title = translate(language, "common.untitled");
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
    skipReason: translate(language, "service.contentRestrictedSkip"),
    isYoutubeVideo: isYoutube,
    useVideoMultimodal: false,
    lowResVideo: false,
    contentTypeHint: isYoutube ? "video" : null
  };
};

// 1단계 (GitHub): 공식 REST API와 HEAD Raw README를 단일 5초 윈도우 내에서 병렬 호출한다.
const scrapeGithubUrl = async (url, { owner, repo }, language = "en") => {
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
      return text.substring(0, 10000);
    })()
  ]);

  const repoData = apiResult.status === "fulfilled" ? apiResult.value : null;
  const readmeText = readmeResult.status === "fulfilled" ? readmeResult.value : "";

  if (!repoData && !readmeText.trim()) {
    return buildFallbackScrap(url, language);
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
    isYoutubeVideo: false,
    useVideoMultimodal: false,
    lowResVideo: false,
    contentTypeHint: "tech"
  };
};

// 2단계: 자체 Cloudflare Workers 스크래핑 프록시 서버를 통해 HTML 본문을 가져온다.
const fetchHtmlViaCustomProxy = async (target) => {
  const baseUrl = getProxyBaseUrl();
  const proxyUrl = `${baseUrl}/?url=${encodeURIComponent(target)}`;
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(proxyUrl, { headers });
  if (!response.ok) throw new Error(`CustomProxy HTTP ${response.status}`);
  const text = await response.text();
  if (!text || !text.trim() || isAntiBotInterstitial(text)) {
    throw new Error("CustomProxy empty or anti-bot interstitial");
  }
  return text;
};

const fetchYoutubeDurationSeconds = async (videoId) => {
  try {
    const baseUrl = getProxyBaseUrl();
    const apiUrl = `${baseUrl}/youtube-duration?videoId=${encodeURIComponent(videoId)}`;
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(apiUrl, { headers });
    if (!res.ok) {
      console.warn(`YouTube duration proxy failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return typeof data?.seconds === "number" ? data.seconds : null;
  } catch (e) {
    console.warn("YouTube duration fetch error:", e.message);
    return null;
  }
};

export const fetchYoutubeTranscript = async (videoId, language = "en") => {
  if (!videoId) return null;
  try {
    const baseUrl = getProxyBaseUrl();
    const lang = language === "ko" ? "ko" : "en";
    const apiUrl = `${baseUrl}/youtube-transcript?videoId=${encodeURIComponent(videoId)}&lang=${lang}`;
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(apiUrl, { headers }, TRANSCRIPT_TIMEOUT_MS);
    if (!res.ok) {
      console.warn(`YouTube transcript proxy failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (typeof data?.transcript === "string" && data.transcript.trim()) {
      return data;
    }
    return null;
  } catch (e) {
    console.warn("YouTube transcript fetch error:", e.message);
    return null;
  }
};

/**
 * URL에서 메타데이터(제목, 썸네일) 및 본문 텍스트를 추출합니다.
 * @param {string} url - 스크랩할 대상 URL
 * @param {{ checkDuration?: boolean, language?: string }} [options]
 * @returns {Promise<{title: string, thumbnail: string, content: string, description: string, skipAi: boolean, skipReason: string, isYoutubeVideo: boolean, useVideoMultimodal: boolean, lowResVideo: boolean, contentTypeHint: string|null}>}
 */
export const scrapeUrl = async (url, { checkDuration = true, language = "en" } = {}) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(translate(language, "service.invalidUrlFormat"));
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(translate(language, "service.invalidUrlProtocol"));
  }

  try {
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

    // 1단계 A: YouTube (oEmbed + 영상 길이 확인 + 3분 초과 시 자막 기반 분석 전환)
    if (isYoutube) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetchWithTimeout(oembedUrl);
        if (!response.ok) throw new Error(`YouTube oEmbed failed: HTTP ${response.status}`);
        const data = await response.json();
        const ytTitle = data.title || translate(language, "common.untitled");
        const ytChannel = data.author_name || "";

        const videoId = extractYoutubeVideoId(url);
        let skipAi = false;
        let skipReason = "";
        let useVideoMultimodal = true;
        let lowResVideo = false;
        let content = `Title: ${ytTitle}\nChannel: ${ytChannel}`;

        if (checkDuration && videoId) {
          const seconds = await fetchYoutubeDurationSeconds(videoId);
          if (seconds !== null && seconds > YOUTUBE_AI_MAX_SECONDS) {
            const mm = Math.floor(seconds / 60);
            const ss = seconds % 60;
            // 3분 초과 영상은 자막(Transcript)을 추출해 텍스트 모드로 고속 요약 시도
            const transcriptResult = await fetchYoutubeTranscript(videoId, language);
            if (transcriptResult?.transcript && transcriptResult.transcript.length >= 30) {
              useVideoMultimodal = false;
              lowResVideo = false;
              content = [
                `Title: ${ytTitle}`,
                ytChannel ? `Channel: ${ytChannel}` : "",
                `Duration: ${mm}:${String(ss).padStart(2, "0")}`,
                "",
                "[YouTube Video Transcript]",
                transcriptResult.transcript,
              ]
                .filter((line) => line !== "")
                .join("\n");
            } else if (seconds <= YOUTUBE_MULTIMODAL_FALLBACK_MAX_SECONDS) {
              // 자막 추출이 차단되거나 자막이 없더라도 20분 이하 영상은 저해상도 멀티모달 분석으로 폴백
              skipAi = false;
              useVideoMultimodal = true;
              lowResVideo = true;
            } else {
              skipAi = true;
              useVideoMultimodal = false;
              lowResVideo = false;
              skipReason = translate(language, "service.longVideoNoCaptionsSkip", {
                min: mm,
                sec: ss,
              });
            }
          }
        }

        return {
          title: ytTitle,
          thumbnail: data.thumbnail_url || getGoogleFaviconUrl(url),
          content,
          description: ytChannel ? translate(language, "service.channelPrefix", { name: ytChannel }) : "",
          skipAi,
          skipReason,
          isYoutubeVideo: true,
          useVideoMultimodal,
          lowResVideo,
          contentTypeHint: "video"
        };
      } catch (ytErr) {
        console.warn("[scrapeUrl] YouTube oEmbed failed, falling back to basic info:", ytErr.message);
        return buildFallbackScrap(url, language);
      }
    }

    // 1단계 B: GitHub 저장소 루트 / 브랜치 트리 전용 추출기
    const githubRepo = parseGithubRepoUrl(url);
    if (githubRepo) {
      return await scrapeGithubUrl(url, githubRepo, language);
    }

    // 2단계: 자체 Cloudflare Workers 프록시 호출 + DOMParser 파싱
    const html = await fetchHtmlViaCustomProxy(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property) =>
      doc.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${property}"]`)?.getAttribute("content");

    const rawMetaTitle = getMeta("og:title") || doc.title?.trim() || "";
    let title = rawMetaTitle || translate(language, "common.untitled");
    let description = (getMeta("og:description") || getMeta("description") || "").trim();

    // Notion publish 페이지는 본문/메타가 SSR되지 않아 "Notion | Where teams..." 마케팅 셸이 잡힌다.
    // URL slug에서 페이지 제목을 복원하고, 마케팅 description은 제거해 AI가 셸에 휘둘리지 않게 한다.
    const notionPageTitle = extractNotionPageTitle(url);
    if (notionPageTitle && NOTION_SHELL_TITLE_REGEX.test(title)) {
      title = notionPageTitle;
      description = "";
    }

    const bodyText = Array.from(doc.querySelectorAll("p, h1, h2, h3, article"))
      .map((el) => el.innerText || el.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // 빈 셸이거나 복원 불가능한 Notion 마케팅 셸이면 4단계 최소 정보 폴백으로 전환
    if ((!rawMetaTitle && !description && !bodyText) || (NOTION_SHELL_TITLE_REGEX.test(title) && !notionPageTitle)) {
      return buildFallbackScrap(url, language);
    }

    const ogImage = getMeta("og:image");
    let thumbnail = sanitizeHttpUrl(ogImage, url);
    if (!thumbnail) {
      const iconEl =
        doc.querySelector('link[rel="apple-touch-icon"]') ||
        doc.querySelector('link[rel="icon"][type="image/png"]') ||
        doc.querySelector('link[rel="icon"]') ||
        doc.querySelector('link[rel="shortcut icon"]');
      const href = iconEl?.getAttribute("href") || "";
      thumbnail = sanitizeHttpUrl(href, url) || getGoogleFaviconUrl(url);
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
      isYoutubeVideo: false,
      useVideoMultimodal: false,
      lowResVideo: false,
      contentTypeHint: null
    };
  } catch (error) {
    console.warn("[scrapeUrl] All extraction stages failed, using minimal URL fallback:", error);
    return buildFallbackScrap(url, language);
  }
};
