import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { scrapeUrl } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { useAuth } from "../context/AuthContext";

// Forced site tags: domains whose common name differs from the hostname-derived tag
const FORCED_SITE_TAGS = {
  "news.hada.io": "GeekNews",
};

const getForcedSiteTag = (url) => {
  try {
    return FORCED_SITE_TAGS[new URL(url).hostname.replace(/^www\./, "")] || null;
  } catch {
    return null;
  }
};

const generateBasicTags = (url, isYoutubeVideo) => {
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

// Normalize YouTube URL to the canonical form the Gemini API recognizes
const normalizeYoutubeUrl = (url) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : url;
};

const ReAnalyzeDialog = ({ scrap, onClose }) => {
  const { preferredLanguage, useAi } = useAuth();
  const [localUseAi, setLocalUseAi] = useState(useAi);
  const [localLang, setLocalLang] = useState(preferredLanguage);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState("");

  // Escape key — only when not analyzing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !analyzing) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [analyzing, onClose]);

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setStatus(localLang === "ko" ? "URL 정보 가져오는 중..." : "Fetching URL information...");

    try {
      const {
        title,
        thumbnail,
        content,
        description,
        skipAi,
        skipReason,
        isYoutubeVideo,
      } = await scrapeUrl(scrap.url, { checkDuration: localUseAi });

      let analysis;
      if (!localUseAi) {
        analysis = {
          title,
          tags: generateBasicTags(scrap.url, isYoutubeVideo),
          fullSummary: description || "",
        };
      } else if (skipAi) {
        setStatus(localLang === "ko" ? "긴 영상 감지됨. AI 생략 중..." : "Long video detected. Skipping AI...");
        analysis = {
          title,
          tags: ["YouTube", "Video"],
          fullSummary: skipReason || "Skipped AI analysis.",
        };
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        setStatus(
          isYoutubeVideo
            ? (localLang === "ko" ? "AI가 영상을 분석 중..." : "AI is watching the video...")
            : (localLang === "ko" ? "AI가 내용을 분석 중..." : "AI is analyzing content...")
        );
        const canonicalUrl = isYoutubeVideo ? normalizeYoutubeUrl(scrap.url) : null;
        analysis = await analyzeContent(content, localLang, canonicalUrl);
      }

      // Apply forced site tag (e.g. GeekNews for news.hada.io)
      const forcedTag = getForcedSiteTag(scrap.url);
      if (forcedTag && !analysis.tags.some((t) => t?.toLowerCase() === forcedTag.toLowerCase())) {
        analysis.tags = [forcedTag, ...analysis.tags].slice(0, 3);
      }

      // Build the update payload
      const updatePayload = {
        title: analysis.title,
        tags: analysis.tags,
        fullSummary: analysis.fullSummary,
      };
      if (thumbnail && thumbnail !== "/placeholder.svg") {
        updatePayload.thumbnail = thumbnail;
      }

      await updateDoc(doc(db, "scraps", scrap.id), updatePayload);

      setStatus(localLang === "ko" ? "업데이트 완료!" : "Updated successfully!");

      await new Promise((resolve) => setTimeout(resolve, 1000));
      onClose();
    } catch (error) {
      console.error(error);
      alert(error.message);
      setAnalyzing(false);
      setStatus("");
    }
  };

  return (
    <motion.div
      className="dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !analyzing) onClose();
      }}
    >
      <motion.div
        className="dialog-box"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-header">
          <h2 style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em" }}>
            Re-Analyze
          </h2>
          <button
            onClick={onClose}
            disabled={analyzing}
            style={{
              background: "rgba(0,0,0,0.06)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: analyzing ? "default" : "pointer",
              opacity: analyzing ? 0.4 : 1,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* URL display */}
        <p
          style={{
            fontSize: "12px",
            color: "#86868B",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={scrap.url}
        >
          {scrap.url}
        </p>

        {/* Controls: AI toggle + Language toggle */}
        <div className="dialog-controls">
          <div className="language-toggle">
            <button
              className={`lang-btn ${!localUseAi ? "active" : ""}`}
              onClick={() => setLocalUseAi(false)}
              disabled={analyzing}
            >
              OFF
            </button>
            <button
              className={`lang-btn ${localUseAi ? "active" : ""}`}
              onClick={() => setLocalUseAi(true)}
              disabled={analyzing}
            >
              AI
            </button>
          </div>
          <div className="language-toggle">
            <button
              className={`lang-btn ${localLang === "en" ? "active" : ""}`}
              onClick={() => setLocalLang("en")}
              disabled={analyzing}
            >
              EN
            </button>
            <button
              className={`lang-btn ${localLang === "ko" ? "active" : ""}`}
              onClick={() => setLocalLang("ko")}
              disabled={analyzing}
            >
              KO
            </button>
          </div>
        </div>

        {/* Status */}
        <AnimatePresence>
          {status && (
            <motion.p
              key="status-text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "var(--accent-color)",
                textAlign: "center",
              }}
            >
              {status}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Analyze button */}
        <button
          className="btn"
          onClick={handleAnalyze}
          disabled={analyzing}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "14px",
            opacity: analyzing ? 0.7 : 1,
            cursor: analyzing ? "default" : "pointer",
          }}
        >
          {analyzing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              {localLang === "ko" ? "분석 중..." : "Analyzing..."}
            </>
          ) : (
            localLang === "ko" ? "분석하기" : "Analyze"
          )}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default ReAnalyzeDialog;
