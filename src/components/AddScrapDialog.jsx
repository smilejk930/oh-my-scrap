import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { scrapeUrl } from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { X, Clipboard, Send, Loader2, CheckCircle } from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";

// AI/비-AI 경로와 무관하게 호스트네임만으로 태그를 강제하고 싶은 사이트.
// 도메인에서 추출한 도메인 파트("Hada")가 사이트의 통용 명칭("GeekNews")과 다른 경우에 사용.
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

const AddScrapDialog = ({ onClose }) => {
  const { user, preferredLanguage, useAi, updateLanguage, updateUseAi } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(null);
  const closeTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Escape key handler + cleanup close timer on unmount
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [loading, onClose]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      // Silently fail if clipboard access is denied or unavailable
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setPreview(null);
    try {
      setStatus("Fetching URL information...");
      const { title, thumbnail, content, description, skipAi, skipReason, isYoutubeVideo } = await scrapeUrl(url, { checkDuration: useAi });

      let analysis;
      if (!useAi) {
        analysis = {
          title,
          tags: generateBasicTags(url, isYoutubeVideo),
          fullSummary: description || ""
        };
      } else if (skipAi) {
        setStatus("Long video detected. Skipping AI...");
        analysis = {
          title,
          tags: ["YouTube", "Video"],
          fullSummary: skipReason || "Skipped AI analysis."
        };
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        setStatus(isYoutubeVideo ? "AI is watching the video..." : "AI is analyzing content...");
        analysis = await analyzeContent(content, preferredLanguage, isYoutubeVideo ? url : null);
      }

      // 특정 사이트(예: GeekNews)는 AI가 다른 태그를 뽑더라도 사이트 태그를 강제로 앞에 붙인다.
      const forcedTag = getForcedSiteTag(url);
      if (forcedTag && !analysis.tags.some(t => t?.toLowerCase() === forcedTag.toLowerCase())) {
        analysis.tags = [forcedTag, ...analysis.tags].slice(0, 3);
      }

      // YouTube 영상은 AI 경로 결과에도 "YouTube" 태그를 항상 보장한다.
      if (isYoutubeVideo && !analysis.tags.some(t => t?.toLowerCase() === "youtube")) {
        analysis.tags = ["YouTube", ...analysis.tags].slice(0, 3);
      }

      const newScrap = {
        userId: user.uid,
        url,
        title: analysis.title,
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        fullSummary: analysis.fullSummary,
        createdAt: serverTimestamp()
      };

      setPreview(newScrap);
      setStatus("Analysis complete!");

      await addDoc(collection(db, "scraps"), newScrap);

      // Wait 1.5 s so the user sees the success preview, then close.
      // Keeping this inside try means finally (state reset) runs AFTER onClose,
      // so the submit button stays disabled while the dialog is still visible.
      await new Promise((resolve) => {
        closeTimerRef.current = setTimeout(resolve, 1500);
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert(error.message);
      // Only reset state on error path — component is still mounted.
      if (isMountedRef.current) {
        setLoading(false);
        setStatus("");
      }
    }
  };

  return (
    <AnimatePresence>
      <Motion.div
        className="dialog-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !loading) onClose();
        }}
      >
        <Motion.div
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
              <h2 style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em" }}>Add Scrap</h2>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.4 : 1
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Controls: AI toggle + Language toggle */}
            <div className="dialog-controls">
              <div className="language-toggle">
                <button
                  className={`lang-btn ${!useAi ? "active" : ""}`}
                  onClick={() => updateUseAi(false)}
                >
                  OFF
                </button>
                <button
                  className={`lang-btn ${useAi ? "active" : ""}`}
                  onClick={() => updateUseAi(true)}
                >
                  AI
                </button>
              </div>
              <div className="language-toggle">
                <button
                  className={`lang-btn ${preferredLanguage === "en" ? "active" : ""}`}
                  onClick={() => updateLanguage("en")}
                >
                  EN
                </button>
                <button
                  className={`lang-btn ${preferredLanguage === "ko" ? "active" : ""}`}
                  onClick={() => updateLanguage("ko")}
                >
                  KO
                </button>
              </div>
            </div>

            {/* Status text */}
            <AnimatePresence>
              {status && (
                <Motion.p
                  key="status-text"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{ fontSize: "14px", fontWeight: "500", color: "var(--accent-color)", textAlign: "center" }}
                >
                  {status}
                </Motion.p>
              )}
            </AnimatePresence>

            {/* Preview card */}
            <AnimatePresence>
              {preview && (
                <Motion.div
                  key="preview-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    padding: "14px", background: "rgba(0,0,0,0.02)",
                    borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)"
                  }}
                >
                  <div className="scrap-item-row">
                    <img
                      src={preview.thumbnail || "/placeholder.svg"}
                      alt="preview"
                      className="scrap-thumbnail"
                      onError={(e) => e.target.src = "/placeholder.svg"}
                    />
                    <div className="scrap-content">
                      <h3 className="scrap-title" style={{ fontSize: "15px", color: "#0071E3" }}>{preview.title}</h3>
                      <div style={{ display: "flex", gap: "5px", marginTop: "5px", flexWrap: "wrap" }}>
                        {preview.tags?.filter(tag => tag && tag.trim()).map((tag, index) => (
                          <span key={`${tag}-${index}`} style={{ fontSize: "11px", background: "#eee", padding: "2px 8px", borderRadius: "10px" }}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "5px", color: "#34C759" }}>
                    <CheckCircle size={16} />
                    <span style={{ fontSize: "13px", fontWeight: "600" }}>Saved successfully!</span>
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>

            {/* URL input row — pushed to bottom on mobile via dialog-url-row + margin-top: auto in CSS */}
            <form className="dialog-url-row" onSubmit={handleSubmit}>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onContextMenu={(e) => e.stopPropagation()}
                disabled={loading}
                required
                style={{ flex: 1, margin: 0 }}
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={loading}
                title="Paste from clipboard"
                style={{
                  flexShrink: 0,
                  width: "46px",
                  height: "46px",
                  borderRadius: "12px",
                  border: "none",
                  background: "rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: loading ? "default" : "pointer",
                  color: "var(--text-secondary)"
                }}
              >
                <Clipboard size={18} />
              </button>
              <Motion.button
                type="submit"
                disabled={loading || !url}
                whileHover={url && !loading ? { scale: 1.06 } : {}}
                whileTap={url && !loading ? { scale: 0.93 } : {}}
                style={{
                  flexShrink: 0,
                  width: "46px",
                  height: "46px",
                  borderRadius: "12px",
                  border: "none",
                  background: url && !loading ? "var(--accent-color)" : "rgba(0,0,0,0.06)",
                  color: url && !loading ? "#fff" : "#A1A1A6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: url && !loading ? "pointer" : "default",
                  boxShadow: url && !loading ? "0 4px 12px rgba(0,113,227,0.25)" : "none",
                  transition: "background 0.2s, box-shadow 0.2s"
                }}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </Motion.button>
            </form>
          </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
};

export default AddScrapDialog;
