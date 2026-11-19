import React, { useState } from "react";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Pin,
  CheckCircle2,
  Circle,
  Pencil,
  StickyNote,
  Check,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  scrapeUrl,
  applyRequiredTags,
  generateBasicTags,
  openSafeUrl,
} from "../services/scraper";
import { analyzeContent } from "../services/gemini";
import { useAuth } from "../context/AuthContext";
import { useScraps } from "../context/ScrapContext";
import ReAnalyzeDialog from "./ReAnalyzeDialog";
import SmartSummaryView from "./SmartSummaryView";

const ScrapItem = ({
  scrap,
  mode,
  isDesktop,
  isSelected,
  onSelect,
  onDelete,
  onTagClick,
  isMobileExpanded = false,
  onToggleMobileExpand,
}) => {
  const { preferredLanguage } = useAuth();
  const { togglePin, toggleRead, markRead, saveUserNote, updateScrap, deleteScrap } = useScraps();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReAnalyzeOpen, setIsReAnalyzeOpen] = useState(false);

  // 모바일 인라인 편집 상태
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [editTitle, setEditTitle] = useState(scrap.title || "");
  const [editTags, setEditTags] = useState(Array.isArray(scrap.tags) ? scrap.tags : []);
  const [tagInput, setTagInput] = useState("");
  const [editSummary, setEditSummary] = useState(scrap.fullSummary || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 모바일 개인 메모 상태
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(scrap.userNote || "");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const createdAt = scrap.createdAt?.toDate ? scrap.createdAt.toDate() : null;
  const dateStr = createdAt ? format(createdAt, "yy.MM.dd") : "Just now";
  const isUnread = scrap.isRead !== true;
  const isPinned = Boolean(scrap.isPinned);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this?")) {
      try {
        await deleteScrap(scrap.id);
        if (onDelete) onDelete(scrap.id);
      } catch (error) {
        console.error(error);
        alert("An error occurred while deleting.");
      }
    }
  };

  // 텔레그램 등을 통해 들어온 분석 안된 데이터 처리
  const handleDelayedAnalysis = async (e) => {
    e.stopPropagation();
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const {
        title,
        thumbnail,
        content,
        skipAi,
        skipReason,
        isYoutubeVideo,
        useVideoMultimodal,
        contentTypeHint,
      } = await scrapeUrl(scrap.url, { checkDuration: true, language: preferredLanguage });

      let analysis;
      if (skipAi) {
        analysis = {
          title,
          tags: generateBasicTags(scrap.url, isYoutubeVideo),
          contentType: contentTypeHint || (isYoutubeVideo ? "video" : "general"),
          fullSummary: skipReason || (isYoutubeVideo ? "Skipped AI analysis." : ""),
        };
      } else {
        analysis = await analyzeContent(
          content,
          preferredLanguage,
          useVideoMultimodal ? scrap.url : null,
          { contentTypeHint }
        );
      }

      analysis.tags = applyRequiredTags(analysis.tags, scrap.url, isYoutubeVideo);

      await updateScrap(scrap.id, {
        title: analysis.title,
        originalTitle: title,
        thumbnail,
        tags: analysis.tags,
        contentType: analysis.contentType || contentTypeHint || (isYoutubeVideo ? "video" : "general"),
        fullSummary: analysis.fullSummary,
        isRead: false,
        isPinned: false,
      });
    } catch (error) {
      console.error(error);
      alert("An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpen = (e) => {
    e?.stopPropagation();
    markRead(scrap);
    openSafeUrl(scrap.url);
  };

  const handleStartMobileEdit = (e) => {
    e.stopPropagation();
    setEditTitle(scrap.title || "");
    setEditTags(Array.isArray(scrap.tags) ? scrap.tags : []);
    setTagInput("");
    setEditSummary(scrap.fullSummary || "");
    setIsEditingMobile(true);
  };

  const handleSaveMobileEdit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const pendingTag = tagInput.replace(/^#/, "").trim();
      const finalTags =
        pendingTag && editTags.length < 10 && !editTags.some((t) => t.toLowerCase() === pendingTag.toLowerCase())
          ? [...editTags, pendingTag]
          : editTags;

      await updateScrap(scrap.id, {
        title: editTitle.trim() || scrap.title || "Untitled",
        tags: finalTags,
        fullSummary: editSummary,
      });
      setTagInput("");
      setIsEditingMobile(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update scrap.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveMobileNote = async (e) => {
    e?.stopPropagation();
    if (isSavingNote) return;
    setIsSavingNote(true);
    try {
      await saveUserNote(scrap.id, noteDraft.trim());
      setIsEditingNote(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  if (mode === "card") {
    return (
      <>
        <motion.div
          layout
          transition={{ layout: { duration: 0.15, ease: "easeOut" } }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          id={`scrap-item-${scrap.id}`}
          className={`card ${isSelected ? "selected" : ""}`}
          style={{
            padding: "0",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            cursor: "pointer",
            border: isSelected ? "2px solid #0071E3" : "1px solid rgba(0,0,0,0.05)",
          }}
          onClick={() => (isDesktop ? onSelect() : handleOpen())}
        >
          <div style={{ height: "160px", background: "#f0f0f0", position: "relative" }}>
            <img
              src={scrap.thumbnail || "/placeholder.svg"}
              alt="thumb"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.target.src = "/placeholder.svg";
              }}
            />
            {isPinned && (
              <span className="pin-badge card-pin" title="Pinned">
                <Pin size={12} />
              </span>
            )}
            <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn"
                title={isPinned ? "Unpin" : "Pin to top"}
                style={{
                  width: "34px",
                  height: "34px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: isPinned ? "var(--accent-color)" : "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                  color: isPinned ? "#fff" : "var(--text-primary)",
                  border: "none",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(scrap);
                }}
              >
                <Pin size={15} />
              </button>
              <button
                type="button"
                className="btn"
                title="Re-analyze"
                style={{
                  width: "34px",
                  height: "34px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                  color: "var(--accent-color)",
                  border: "none",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReAnalyzeOpen(true);
                }}
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                className="btn"
                title="Delete"
                style={{
                  width: "34px",
                  height: "34px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                  color: "#FF3B30",
                  border: "none",
                }}
                onClick={handleDelete}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div style={{ padding: "15px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "8px" }}>
              {isUnread && <span className="unread-dot" style={{ marginTop: "7px" }} title="Unread" />}
              <h3 className="scrap-title" style={{ fontSize: "17px", whiteSpace: "normal", margin: 0 }}>
                {scrap.title || "Unanalyzed Scrap"}
              </h3>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", flex: 1 }}>
                <span style={{ fontSize: "12px", color: "#86868B", whiteSpace: "nowrap" }}>{dateStr}</span>
                <div style={{ display: "flex", gap: "5px", overflow: "hidden", flex: 1 }}>
                  {scrap.tags?.filter((tag) => tag && tag.trim()).slice(0, 3).map((tag, index) => (
                    <button
                      key={`${tag}-${index}`}
                      type="button"
                      className="item-tag-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick?.(tag);
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
              {!scrap.title && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px", marginLeft: "10px", whiteSpace: "nowrap" }}
                  onClick={handleDelayedAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
        <AnimatePresence>
          {isReAnalyzeOpen && (
            <ReAnalyzeDialog scrap={scrap} onClose={() => setIsReAnalyzeOpen(false)} />
          )}
        </AnimatePresence>
      </>
    );
  }

  // List Mode
  return (
    <>
      <motion.div
        layout
        transition={{ layout: { duration: 0.12, ease: "easeOut" } }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        id={`scrap-item-${scrap.id}`}
        className={`card ${isSelected ? "selected" : ""}`}
        style={{
          padding: "12px",
          marginBottom: "0",
          border: isSelected ? "2px solid #0071E3" : "1px solid rgba(0,0,0,0.05)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => (isDesktop ? onSelect() : onToggleMobileExpand?.())}
      >
        <div className="scrap-item-row">
          <img
            src={scrap.thumbnail || "/placeholder.svg"}
            alt="thumb"
            className="scrap-thumbnail"
            onError={(e) => {
              e.target.src = "/placeholder.svg";
            }}
          />
          <div className="scrap-content">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              {isUnread && <span className="unread-dot" title="Unread" />}
              {isPinned && (
                <span className="pin-badge" title="Pinned">
                  <Pin size={11} />
                </span>
              )}
              <h3 className="scrap-title">{scrap.title || "Unanalyzed Scrap"}</h3>
            </div>
            <div className="flex-between" style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", gap: "5px", overflow: "hidden" }}>
                {scrap.tags?.filter((tag) => tag && tag.trim()).map((tag, index) => (
                  <button
                    key={`${tag}-${index}`}
                    type="button"
                    className="item-tag-pill small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: "11px", color: "#86868B", marginLeft: "10px", flexShrink: 0 }}>
                {dateStr}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {!scrap.title ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={handleDelayedAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "..." : "Analyze"}
              </button>
            ) : (
              !isDesktop && (
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#C7C7CC", display: "flex" }}
                  aria-label="Toggle details"
                >
                  {isMobileExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              )
            )}
            {isDesktop && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(scrap);
                  }}
                  title={isPinned ? "Unpin" : "Pin to top"}
                  className="list-action-btn"
                  style={{ color: isPinned ? "var(--accent-color)" : "#A1A1A6" }}
                >
                  <Pin size={15} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReAnalyzeOpen(true);
                  }}
                  title="Re-analyze"
                  className="list-action-btn"
                  style={{ color: "var(--accent-color)" }}
                >
                  <RefreshCw size={15} />
                </button>
              </>
            )}
            {(isDesktop || !scrap.title) && (
              <button
                type="button"
                onClick={handleDelete}
                title="Delete"
                className="list-action-btn"
                style={{ color: "#FF3B30" }}
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
        </div>

        {/* 모바일 확장 영역 */}
        {!isDesktop && isMobileExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid rgba(0,0,0,0.05)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isEditingMobile ? (
              <form className="inline-edit-form" onSubmit={handleSaveMobileEdit}>
                <label className="edit-field-label">
                  Title
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={500}
                    required
                  />
                </label>
                <div className="edit-field-label">
                  Tags ({editTags.length}/10)
                  <div className="edit-tags-container">
                    {editTags.map((t, idx) => (
                      <span key={`${t}-${idx}`} className="edit-tag-pill">
                        #{t}
                        <button
                          type="button"
                          onClick={() => setEditTags((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {editTags.length < 10 && (
                      <input
                        type="text"
                        className="edit-tag-input"
                        placeholder="Add tag & Enter..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            const clean = tagInput.replace(/^#/, "").trim();
                            if (clean && !editTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
                              setEditTags((prev) => [...prev, clean]);
                            }
                            setTagInput("");
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
                <label className="edit-field-label">
                  Summary
                  <textarea
                    className="edit-summary-textarea"
                    rows={5}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    maxLength={15000}
                  />
                </label>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => setIsEditingMobile(false)}
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    style={{ padding: "8px 16px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    disabled={isSavingEdit}
                  >
                    <Check size={14} />
                    <span>{isSavingEdit ? "Saving..." : "Save"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                <SmartSummaryView scrap={scrap} compact />

                {/* 모바일 내 메모 */}
                <div className="user-note-box" style={{ marginTop: "12px", marginBottom: "14px" }}>
                  <div className="user-note-header">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <StickyNote size={13} />
                      <span>My Note</span>
                    </span>
                    {!isEditingNote && (
                      <button
                        type="button"
                        className="user-note-action-btn"
                        onClick={() => {
                          setNoteDraft(scrap.userNote || "");
                          setIsEditingNote(true);
                        }}
                      >
                        {scrap.userNote ? "Edit" : "+ Add Note"}
                      </button>
                    )}
                  </div>
                  {isEditingNote ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <textarea
                        className="user-note-textarea"
                        placeholder="Why did you save this? Add your thoughts..."
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={2}
                        maxLength={5000}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          type="button"
                          className="user-note-cancel-btn"
                          onClick={() => setIsEditingNote(false)}
                          disabled={isSavingNote}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="user-note-save-btn"
                          onClick={handleSaveMobileNote}
                          disabled={isSavingNote}
                        >
                          {isSavingNote ? "Saving..." : "Save Note"}
                        </button>
                      </div>
                    </div>
                  ) : scrap.userNote ? (
                    <p
                      className="user-note-text"
                      onClick={() => {
                        setNoteDraft(scrap.userNote || "");
                        setIsEditingNote(true);
                      }}
                    >
                      {scrap.userNote}
                    </p>
                  ) : (
                    <p
                      className="user-note-placeholder"
                      onClick={() => {
                        setNoteDraft("");
                        setIsEditingNote(true);
                      }}
                    >
                      Tap to add a quick note...
                    </p>
                  )}
                </div>

                {/* 모바일 하단 액션 행 */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      fontSize: "14px",
                    }}
                    onClick={handleOpen}
                  >
                    <ExternalLink size={15} />
                    View Original
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(scrap)}
                    title={isPinned ? "Unpin" : "Pin"}
                    className={`mobile-action-square ${isPinned ? "active" : ""}`}
                  >
                    <Pin size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRead(scrap)}
                    title={isUnread ? "Mark as read" : "Mark as unread"}
                    className={`mobile-action-square ${!isUnread ? "active-green" : ""}`}
                  >
                    {!isUnread ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartMobileEdit}
                    title="Edit"
                    className="mobile-action-square"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReAnalyzeOpen(true)}
                    title="Re-analyze"
                    className="mobile-action-square"
                    style={{ color: "var(--accent-color)" }}
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    title="Delete"
                    className="mobile-action-square"
                    style={{ color: "#FF3B30" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </motion.div>
      <AnimatePresence>
        {isReAnalyzeOpen && (
          <ReAnalyzeDialog scrap={scrap} onClose={() => setIsReAnalyzeOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default ScrapItem;
