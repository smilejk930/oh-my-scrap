/**
 * oh-my-scrap 전용 Cloudflare Workers 스크래핑 프록시 서버
 *
 * 주요 기능:
 * 1. Origin 화이트리스트 검증 (오픈 프록시 악용 방지)
 * 2. SSRF 방어 (사설 IP, 루프백, 클라우드 메타데이터 호스트 차단 및 리다이렉트 재검증)
 * 3. 브라우저 헤더 스푸핑 및 EUC-KR/CP949 한글 인코딩 자동 UTF-8 변환
 * 4. 사이트별 맞춤 추출 (Notion 공개 페이지 블록 본문 합성, Reddit JSON/old.reddit 폴백)
 * 5. Anti-bot 챌린지(Cloudflare 인터스티셜) 감지 시 502 반환
 * 6. Cloudflare Edge Cache 지원
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://oh-my-scrap.web.app",
  "https://oh-my-scrap.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const NOTION_PAGE_ID_EXTRACT_REGEX = /([0-9a-f]{32})(?:[/?#]|$)/i;

/**
 * Origin 허용 여부 확인 및 CORS 헤더 생성
 */
const getAllowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const rawList = env?.ALLOWED_ORIGINS;
  const allowedList = rawList
    ? rawList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;

  if (allowedList.includes("*") || allowedList.includes(origin)) {
    return origin;
  }
  return null;
};

const buildCorsHeaders = (allowedOrigin) => {
  const headers = new Headers();
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
};

const jsonResponse = (body, status, corsHeaders) => {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
};

/**
 * SSRF 방어를 위한 호스트명/IP 검증
 * 루프백, 사설망(RFC 1918), 링크 로컬(AWS/GCP 메타데이터), 내부 도메인 차단
 */
const isBlockedHostname = (hostname) => {
  if (!hostname) return true;
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower === "metadata.google.internal" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower === "::"
  ) {
    return true;
  }

  // IPv6 사설/링크로컬 대역 (fc00::/7, fe80::/10, ::ffff:127.x 등)
  if (lower.includes(":")) {
    if (
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("::ffff:")
    ) {
      return true;
    }
  }

  // IPv4 주소 형식 검사
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // Link-local / Cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // RFC 1918
      (a === 192 && b === 168) || // RFC 1918
      a >= 224 // Multicast & Reserved
    ) {
      return true;
    }
  }

  return false;
};

/**
 * 대상 URL 유효성 및 SSRF 여부 검증
 */
const validateTargetUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "Missing 'url' query parameter." };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL format." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http and https protocols are allowed." };
  }
  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, reason: "Target hostname is restricted." };
  }
  return { ok: true, url: parsed };
};

/**
 * Cloudflare 등 봇 차단 인터스티셜 페이지 여부 판별
 */
const isAntiBotInterstitial = (html) => {
  if (!html) return false;
  return (
    /<title>\s*Just a moment\.\.\.?/i.test(html) ||
    /__cf_chl_(?:tk|f_tk|opt)/.test(html) ||
    /challenges\.cloudflare\.com/i.test(html) ||
    /cf-browser-verification/i.test(html)
  );
};

/**
 * HTML 특수문자 이스케이프
 */
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * 32자리 hex ID를 UUID 형식(8-4-4-4-12)으로 변환
 */
const toUuid = (hex32) =>
  `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`;

/**
 * Notion 공개 페이지(*.notion.site)의 비공식 loadPageChunk API를 호출해
 * 실제 제목과 블록 텍스트를 포함한 정적 HTML을 합성한다.
 */
const trySynthesizeNotionHtml = async (targetUrl) => {
  if (!targetUrl.hostname.endsWith(".notion.site")) return null;
  const match = targetUrl.pathname.match(NOTION_PAGE_ID_EXTRACT_REGEX);
  if (!match) return null;

  const pageId = toUuid(match[1].toLowerCase());
  const apiUrl = `${targetUrl.origin}/api/v3/loadPageChunk`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "application/json",
    },
    body: JSON.stringify({
      pageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const blockMap = data?.recordMap?.block;
  if (!blockMap || typeof blockMap !== "object") return null;

  let pageTitle = "";
  let pageIcon = "";
  const paragraphs = [];

  for (const entry of Object.values(blockMap)) {
    const value = entry?.value;
    if (!value) continue;

    const rawTitleParts = value?.properties?.title;
    if (!Array.isArray(rawTitleParts)) continue;

    const text = rawTitleParts
      .map((part) => (Array.isArray(part) ? part[0] : ""))
      .join("")
      .trim();
    if (!text) continue;

    if (value.type === "page" && !pageTitle) {
      pageTitle = text;
      const cover = value?.format?.page_cover;
      if (cover && typeof cover === "string" && cover.startsWith("http")) {
        pageIcon = cover;
      }
    } else {
      paragraphs.push(text);
    }
  }

  if (!pageTitle && paragraphs.length === 0) return null;

  const titleText = escapeHtml(pageTitle || "Notion Page");
  const descText = escapeHtml(paragraphs.slice(0, 3).join(" ").slice(0, 240));
  const bodyHtml = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${titleText}</title>
  <meta property="og:title" content="${titleText}" />
  <meta property="og:description" content="${descText}" />
  ${pageIcon ? `<meta property="og:image" content="${escapeHtml(pageIcon)}" />` : ""}
</head>
<body>
  <article>
    <h1>${titleText}</h1>
    ${bodyHtml}
  </article>
</body>
</html>`;
};

/**
 * Reddit 게시글 URL인 경우 JSON 엔드포인트(.json)로 본문과 제목을 합성 시도
 */
const trySynthesizeRedditHtml = async (targetUrl) => {
  const host = targetUrl.hostname.toLowerCase();
  if (host !== "reddit.com" && !host.endsWith(".reddit.com")) return null;
  if (!targetUrl.pathname.includes("/comments/")) return null;

  const jsonUrl = new URL(targetUrl.toString());
  jsonUrl.hostname = "www.reddit.com";
  jsonUrl.pathname = jsonUrl.pathname.replace(/\/+$/, "") + ".json";
  jsonUrl.search = "raw_json=1";

  const response = await fetch(jsonUrl.toString(), {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post?.title) return null;

  const title = escapeHtml(post.title);
  const selftext = escapeHtml(post.selftext || "");
  const subreddit = escapeHtml(post.subreddit_name_prefixed || "");
  const thumbnail =
    post.preview?.images?.[0]?.source?.url ||
    (post.thumbnail?.startsWith("http") ? post.thumbnail : "");

  const topComments = (data?.[1]?.data?.children || [])
    .slice(0, 5)
    .map((c) => c?.data?.body)
    .filter(Boolean)
    .map((body) => `<p>${escapeHtml(body)}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} - ${subreddit}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${selftext.slice(0, 240)}" />
  ${thumbnail ? `<meta property="og:image" content="${escapeHtml(thumbnail)}" />` : ""}
</head>
<body>
  <article>
    <h1>${title}</h1>
    <p>${selftext}</p>
    ${topComments}
  </article>
</body>
</html>`;
};

/**
 * 응답 바이트 버퍼에서 인코딩(UTF-8, EUC-KR/CP949 등)을 감지하여 문자열로 디코딩
 */
const decodeHtmlBuffer = (buffer, contentTypeHeader = "") => {
  const headerCharsetMatch = contentTypeHeader.match(/charset=([^\s;]+)/i);
  let charset = headerCharsetMatch ? headerCharsetMatch[1].toLowerCase() : "";

  const utf8Preview = new TextDecoder("utf-8", { fatal: false }).decode(
    buffer.slice(0, 2048)
  );
  if (!charset) {
    const metaCharsetMatch =
      utf8Preview.match(/<meta[^>]+charset=["']?\s*([a-zA-Z0-9_-]+)/i) ||
      utf8Preview.match(/content=["'][^"']*charset=([a-zA-Z0-9_-]+)/i);
    if (metaCharsetMatch) {
      charset = metaCharsetMatch[1].toLowerCase();
    }
  }

  if (charset === "euc-kr" || charset === "ks_c_5601-1987" || charset === "cp949") {
    try {
      return new TextDecoder("euc-kr").decode(buffer);
    } catch {
      // TextDecoder가 euc-kr을 지원하지 않는 환경이면 utf-8로 폴백
    }
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
};

/**
 * 리다이렉트를 수동 추적하며 매 홉마다 SSRF 검증 수행 (최대 5회)
 */
const fetchWithSafeRedirects = async (initialUrl, maxRedirects = 5) => {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validation = validateTargetUrl(currentUrl.toString());
    if (!validation.ok) {
      throw new Error(`Blocked redirect target: ${validation.reason}`);
    }

    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        throw new Error(`Redirect (${response.status}) without Location header`);
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
};

export default {
  async fetch(request, env, ctx) {
    const allowedOrigin = getAllowedOrigin(request, env);
    const corsHeaders = buildCorsHeaders(allowedOrigin || "*");

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method Not Allowed" }, 405, corsHeaders);
    }

    // 2. Origin 헤더가 존재하는 경우 화이트리스트 검증
    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && !allowedOrigin) {
      return jsonResponse(
        { error: "Origin not allowed", origin: requestOrigin },
        403,
        corsHeaders
      );
    }

    const reqUrl = new URL(request.url);

    // 헬스체크 엔드포인트
    if (reqUrl.pathname === "/health") {
      return jsonResponse({ status: "ok", service: "oh-my-scrap-proxy" }, 200, corsHeaders);
    }

    const targetParam = reqUrl.searchParams.get("url") || reqUrl.searchParams.get("quest");
    const validation = validateTargetUrl(targetParam);
    if (!validation.ok) {
      return jsonResponse({ error: validation.reason }, 400, corsHeaders);
    }

    const targetUrl = validation.url;
    const cacheTtl = Number(env?.CACHE_TTL_SECONDS) || 300;
    const maxBytes = Number(env?.MAX_RESPONSE_BYTES) || 2 * 1024 * 1024;

    // 3. Edge Cache 조회
    const cacheKey = new Request(
      `${reqUrl.origin}/?url=${encodeURIComponent(targetUrl.toString())}`,
      { method: "GET" }
    );
    const cache = typeof caches !== "undefined" ? caches.default : null;
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hitHeaders = new Headers(cached.headers);
        corsHeaders.forEach((v, k) => hitHeaders.set(k, v));
        hitHeaders.set("X-Proxy-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers: hitHeaders });
      }
    }

    try {
      let html = null;

      // 4. 사이트별 특화 추출 (Notion 공개 페이지 / Reddit 게시글)
      if (targetUrl.hostname.endsWith(".notion.site")) {
        try {
          html = await trySynthesizeNotionHtml(targetUrl);
        } catch {
          html = null;
        }
      } else if (
        targetUrl.hostname === "reddit.com" ||
        targetUrl.hostname.endsWith(".reddit.com")
      ) {
        try {
          html = await trySynthesizeRedditHtml(targetUrl);
        } catch {
          html = null;
        }
      }

      // 5. 일반 HTTP Fetch (안전한 리다이렉트 추적 및 인코딩 변환)
      if (!html) {
        let fetchTarget = targetUrl;
        if (
          (targetUrl.hostname === "reddit.com" ||
            targetUrl.hostname.endsWith(".reddit.com")) &&
          targetUrl.hostname !== "old.reddit.com"
        ) {
          fetchTarget = new URL(targetUrl.toString());
          fetchTarget.hostname = "old.reddit.com";
        }

        let upstream = await fetchWithSafeRedirects(fetchTarget);
        if (!upstream.ok && fetchTarget.toString() !== targetUrl.toString()) {
          upstream = await fetchWithSafeRedirects(targetUrl);
        }
        if (!upstream.ok) {
          return jsonResponse(
            { error: `Upstream HTTP ${upstream.status}` },
            502,
            corsHeaders
          );
        }

        const contentType = upstream.headers.get("Content-Type") || "";
        const buffer = await upstream.arrayBuffer();
        const slicedBuffer =
          buffer.byteLength > maxBytes ? buffer.slice(0, maxBytes) : buffer;

        html = decodeHtmlBuffer(slicedBuffer, contentType);
      }

      // 6. Anti-bot 챌린지 인터스티셜 검증
      if (isAntiBotInterstitial(html)) {
        return jsonResponse(
          { error: "Upstream returned an anti-bot interstitial challenge" },
          502,
          corsHeaders
        );
      }

      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      responseHeaders.set("Cache-Control", `public, max-age=${cacheTtl}`);
      responseHeaders.set("X-Proxy-Cache", "MISS");

      const finalResponse = new Response(html, {
        status: 200,
        headers: responseHeaders,
      });

      if (cache && ctx?.waitUntil) {
        ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
      }

      return finalResponse;
    } catch (error) {
      return jsonResponse(
        { error: error.message || "Failed to fetch target URL" },
        502,
        corsHeaders
      );
    }
  },
};
