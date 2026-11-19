import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useScraps } from "../context/ScrapContext";
import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  scrapeUrl,
  applyRequiredTags,
  generateBasicTags,
  extractFirstUrl,
  extractYoutubeVideoId,
} from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import ReAnalyzeDialog from "./ReAnalyzeDialog";
import {
  X,
  Clipboard,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const AddScrapDialog = ({ onClose, initialUrl = "", onViewExisting }) => {
  const { user, preferredLanguage, useAi, updateLanguage, updateUseAi } = useAuth();
  const { findDuplicateScrap } = useScraps();

  const [url, setUrl] = useState(initialUrl);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [clipboardSuggestion, setClipboardSuggestion] = useState(null);
  const [reAnalyzeTarget, setReAnalyzeTarget] = useState(null);
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

  // 클립보드 읽기 권한이 이미 허용된 경우, 모달 오픈 시 URL 자동 제안
  useEffect(() => {
    if (initialUrl) return;
    let cancelled = false;
    if (navigator.permissions?.query && navigator.clipboard?.readText) {
      navigator.permissions
        .query({ name: "clipboard-read" })
        .then((perm) => {
          if (perm.state === "granted" && !cancelled) {
            return navigator.clipboard.readText();
          }
          return null;
        })
        .then((text) => {
          if (cancelled || !text) return;
          const found = extractFirstUrl(text);
          if (found) {
            setClipboardSuggestion(found);
          }
        })
        .catch(() => {
          // 권한 API 미지원 또는 거부 시 조용히 무시
        });
    }
    return () => {
      cancelled = true;
    };
  }, [initialUrl]);

  // Escape 키 및 모달 내 전역 Ctrl+V URL 추출 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading && !reAnalyzeTarget) {
        onClose();
      }
    };
    const handlePasteEvent = (e) => {
      if (loading || reAnalyzeTarget) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const text = e.clipboardData?.getData("text");
      const found = extractFirstUrl(text);
      if (found) {
        e.preventDefault();
        setUrl(found);
        setAllowDuplicate(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("paste", handlePasteEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePasteEvent);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [loading, reAnalyzeTarget, onClose]);

  const duplicateScrap = useMemo(() => findDuplicateScrap(url), [findDuplicateScrap, url]);

  const handleUrlChange = (nextUrl) => {
    setUrl(nextUrl);
    setAllowDuplicate(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const extracted = extractFirstUrl(text);
        handleUrlChange(extracted || text.trim());
        setClipboardSuggestion(null);
      }
    } catch {
      // Silently fail if clipboard access is denied or unavailable
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url || loading) return;
    if (duplicateScrap && !allowDuplicate) return;

    setLoading(true);
    setPreview(null);
    try {
      const isYoutubeInput = Boolean(extractYoutubeVideoId(url));
      setStatus(
        isYoutubeInput && useAi
          ? "Checking video & transcript..."
          : "Fetching URL information..."
      );
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
      } = await scrapeUrl(url, { checkDuration: useAi, language: preferredLanguage });

      let analysis;
      if (!useAi) {
        analysis = {
          title,
          tags: generateBasicTags(url, isYoutubeVideo),
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
          tags: generateBasicTags(url, isYoutubeVideo),
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
          preferredLanguage,
          useVideoMultimodal ? url : null,
          { contentTypeHint }
        );
      }

      analysis.tags = applyRequiredTags(analysis.tags, url, isYoutubeVideo);

      const newScrap = {
        userId: user.uid,
        url,
        title: analysis.title,
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        contentType: analysis.contentType || contentTypeHint || (isYoutubeVideo ? "video" : "general"),
        fullSummary: analysis.fullSummary,
        isPinned: false,
        isRead: false,
        createdAt: serverTimestamp(),
      };

      setPreview(newScrap);
      setStatus("Analysis complete!");

      await addDoc(collection(db, "scraps"), newScrap);

      // 성공 프리뷰를 잠시 보여준 뒤 모달 닫기
      await new Promise((resolve) => {
        closeTimerRef.current = setTimeout(resolve, 1400);
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert(error.message);
      if (isMountedRef.current) {
        setLoading(false);
        setStatus("");
      }
    }
  };

  return (
    <>
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
            <h2 style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em" }}>
              Add Scrap
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="icon-circle-btn"
              style={{
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.4 : 1,
              }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Controls: AI toggle + Language toggle */}
          <div className="dialog-controls">
            <div className="language-toggle">
              <button
                type="button"
                className={`lang-btn ${!useAi ? "active" : ""}`}
                onClick={() => updateUseAi(false)}
                disabled={loading}
              >
                OFF
              </button>
              <button
                type="button"
                className={`lang-btn ${useAi ? "active" : ""}`}
                onClick={() => updateUseAi(true)}
                disabled={loading}
              >
                AI
              </button>
            </div>
            <div className="language-toggle">
              <button
                type="button"
                className={`lang-btn ${preferredLanguage === "en" ? "active" : ""}`}
                onClick={() => updateLanguage("en")}
                disabled={loading}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${preferredLanguage === "ko" ? "active" : ""}`}
                onClick={() => updateLanguage("ko")}
                disabled={loading}
              >
                KO
              </button>
            </div>
          </div>

          {/* Smart clipboard suggestion chip */}
          {clipboardSuggestion && clipboardSuggestion !== url && !loading && (
            <button
              type="button"
              className="clipboard-chip"
              onClick={() => {
                handleUrlChange(clipboardSuggestion);
                setClipboardSuggestion(null);
              }}
            >
              <Clipboard size={13} style={{ flexShrink: 0 }} />
              <span className="clipboard-chip-text">
                From clipboard: {clipboardSuggestion}
              </span>
            </button>
          )}

          {/* Duplicate URL detection banner */}
          {duplicateScrap && !allowDuplicate && !loading && (
            <div className="duplicate-banner">
              <div className="duplicate-banner-top">
                <AlertCircle size={16} style={{ flexShrink: 0, color: "#C96A00" }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="duplicate-banner-heading">
                    Already saved{" "}
                    {duplicateScrap.createdAt?.toDate
                      ? `on ${format(duplicateScrap.createdAt.toDate(), "yy.MM.dd")}`
                      : "in your archive"}
                  </div>
                  <div className="duplicate-banner-title">
                    {duplicateScrap.title || duplicateScrap.url}
                  </div>
                </div>
                <img
                  src={duplicateScrap.thumbnail || "/placeholder.svg"}
                  alt=""
                  className="duplicate-banner-thumb"
                  onError={(e) => {
                    e.target.src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="duplicate-banner-actions">
                <button
                  type="button"
                  className="dup-btn primary"
                  onClick={() => {
                    onViewExisting?.(duplicateScrap);
                    onClose();
                  }}
                >
                  <ExternalLink size={12} />
                  <span>View Existing</span>
                </button>
                <button
                  type="button"
                  className="dup-btn"
                  onClick={() => setReAnalyzeTarget(duplicateScrap)}
                >
                  <RefreshCw size={12} />
                  <span>Re-analyze</span>
                </button>
                <button
                  type="button"
                  className="dup-btn"
                  onClick={() => setAllowDuplicate(true)}
                >
                  Save Anyway
                </button>
              </div>
            </div>
          )}

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
                  padding: "14px",
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: "12px",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div className="scrap-item-row">
                  <img
                    src={preview.thumbnail || "/placeholder.svg"}
                    alt="preview"
                    className="scrap-thumbnail"
                    onError={(e) => {
                      e.target.src = "/placeholder.svg";
                    }}
                  />
                  <div className="scrap-content">
                    <h3 className="scrap-title" style={{ fontSize: "15px", color: "#0071E3" }}>
                      {preview.title}
                    </h3>
                    <div style={{ display: "flex", gap: "5px", marginTop: "5px", flexWrap: "wrap" }}>
                      {preview.tags?.filter((tag) => tag && tag.trim()).map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          style={{ fontSize: "11px", background: "#eee", padding: "2px 8px", borderRadius: "10px" }}
                        >
                          #{tag}
                        </span>
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

          {/* URL input row */}
          <form className="dialog-url-row" onSubmit={handleSubmit}>
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
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
                color: "var(--text-secondary)",
              }}
            >
              <Clipboard size={18} />
            </button>
            <Motion.button
              type="submit"
              disabled={loading || !url || (Boolean(duplicateScrap) && !allowDuplicate)}
              whileHover={url && !loading && (!duplicateScrap || allowDuplicate) ? { scale: 1.06 } : {}}
              whileTap={url && !loading && (!duplicateScrap || allowDuplicate) ? { scale: 0.93 } : {}}
              style={{
                flexShrink: 0,
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                border: "none",
                background:
                  url && !loading && (!duplicateScrap || allowDuplicate)
                    ? "var(--accent-color)"
                    : "rgba(0,0,0,0.06)",
                color:
                  url && !loading && (!duplicateScrap || allowDuplicate) ? "#fff" : "#A1A1A6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor:
                  url && !loading && (!duplicateScrap || allowDuplicate) ? "pointer" : "default",
                boxShadow:
                  url && !loading && (!duplicateScrap || allowDuplicate)
                    ? "0 4px 12px rgba(0,113,227,0.25)"
                    : "none",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </Motion.button>
          </form>
        </Motion.div>
      </Motion.div>

      <AnimatePresence>
        {reAnalyzeTarget && (
          <ReAnalyzeDialog
            scrap={reAnalyzeTarget}
            onClose={() => setReAnalyzeTarget(null)}
            onSuccess={() => {
              onViewExisting?.(reAnalyzeTarget);
              setReAnalyzeTarget(null);
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default AddScrapDialog;
