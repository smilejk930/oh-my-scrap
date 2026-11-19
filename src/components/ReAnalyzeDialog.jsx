import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  scrapeUrl,
  applyRequiredTags,
  generateBasicTags,
  extractYoutubeVideoId,
} from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { useAuth } from "../context/AuthContext";

const ReAnalyzeDialog = ({ scrap, onClose, onSuccess }) => {
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
    const isYoutubeInput = Boolean(extractYoutubeVideoId(scrap.url));
    setStatus(
      isYoutubeInput && localUseAi
        ? "Checking video & transcript..."
        : "Fetching URL information..."
    );

    try {
      const {
        title,
        thumbnail,
        content,
        description,
        skipAi,
        skipReason,
        isYoutubeVideo,
        useVideoMultimodal,
        contentTypeHint,
      } = await scrapeUrl(scrap.url, { checkDuration: localUseAi, language: localLang });

      let analysis;
      if (!localUseAi) {
        analysis = {
          title,
          tags: generateBasicTags(scrap.url, isYoutubeVideo),
          contentType: contentTypeHint || (isYoutubeVideo ? "video" : "general"),
          fullSummary: description || "",
        };
      } else if (skipAi) {
        setStatus(
          isYoutubeVideo
            ? "No captions found for long video. Saving basic info..."
            : "Content restricted. Saving basic link info..."
        );
        analysis = {
          title,
          tags: generateBasicTags(scrap.url, isYoutubeVideo),
          contentType: contentTypeHint || (isYoutubeVideo ? "video" : "general"),
          fullSummary: skipReason || (isYoutubeVideo ? "Skipped AI analysis." : ""),
        };
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        setStatus(
          useVideoMultimodal
            ? "AI is watching the video..."
            : isYoutubeVideo
              ? "AI is summarizing video transcript..."
              : "AI is analyzing content..."
        );
        analysis = await analyzeContent(
          content,
          localLang,
          useVideoMultimodal ? scrap.url : null,
          { contentTypeHint }
        );
      }

      analysis.tags = applyRequiredTags(analysis.tags, scrap.url, isYoutubeVideo);

      const updatePayload = {
        title: analysis.title,
        tags: analysis.tags,
        contentType: analysis.contentType || contentTypeHint || (isYoutubeVideo ? "video" : "general"),
        fullSummary: analysis.fullSummary,
      };
      if (thumbnail && thumbnail !== "/placeholder.svg") {
        updatePayload.thumbnail = thumbnail;
      }

      await updateDoc(doc(db, "scraps", scrap.id), updatePayload);

      setStatus("Updated successfully!");

      await new Promise((resolve) => setTimeout(resolve, 900));
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
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
            type="button"
            onClick={onClose}
            disabled={analyzing}
            className="icon-circle-btn"
            style={{
              cursor: analyzing ? "default" : "pointer",
              opacity: analyzing ? 0.4 : 1,
            }}
            aria-label="Close"
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
              type="button"
              className={`lang-btn ${!localUseAi ? "active" : ""}`}
              onClick={() => setLocalUseAi(false)}
              disabled={analyzing}
            >
              OFF
            </button>
            <button
              type="button"
              className={`lang-btn ${localUseAi ? "active" : ""}`}
              onClick={() => setLocalUseAi(true)}
              disabled={analyzing}
            >
              AI
            </button>
          </div>
          <div className="language-toggle">
            <button
              type="button"
              className={`lang-btn ${localLang === "en" ? "active" : ""}`}
              onClick={() => setLocalLang("en")}
              disabled={analyzing}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${localLang === "ko" ? "active" : ""}`}
              onClick={() => setLocalLang("ko")}
              disabled={analyzing}
            >
              KO
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <motion.p
            key="status-text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
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

        {/* Analyze button */}
        <button
          type="button"
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
