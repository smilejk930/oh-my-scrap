import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { scrapeUrl, getForcedSiteTag, generateBasicTags } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { useAuth } from "../context/AuthContext";

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
    setStatus("Fetching URL information...");

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
        setStatus(isYoutubeVideo ? "Long video detected. Skipping AI..." : "Content restricted. Saving basic link info...");
        analysis = {
          title,
          tags: generateBasicTags(scrap.url, isYoutubeVideo),
          fullSummary: skipReason || (isYoutubeVideo ? "Skipped AI analysis." : ""),
        };
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        setStatus(isYoutubeVideo ? "AI is watching the video..." : "AI is analyzing content...");
        analysis = await analyzeContent(content, localLang, isYoutubeVideo ? scrap.url : null);
      }

      // Apply forced site tag (e.g. GeekNews for news.hada.io)
      const forcedTag = getForcedSiteTag(scrap.url);
      if (forcedTag && !analysis.tags.some((t) => t?.toLowerCase() === forcedTag.toLowerCase())) {
        analysis.tags = [forcedTag, ...analysis.tags].slice(0, 3);
      }

      // YouTube 영상은 AI 경로 결과에도 "YouTube" 태그를 항상 보장한다.
      if (isYoutubeVideo && !analysis.tags.some((t) => t?.toLowerCase() === "youtube")) {
        analysis.tags = ["YouTube", ...analysis.tags].slice(0, 3);
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

      setStatus("Updated successfully!");

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
              Analyzing...
            </>
          ) : (
            "Analyze"
          )}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default ReAnalyzeDialog;
