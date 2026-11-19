import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  X,
  Pin,
  CheckCircle2,
  Circle,
  Pencil,
  RefreshCw,
  ExternalLink,
  Trash2,
  Check,
  StickyNote,
} from "lucide-react";
import { format } from "date-fns";
import { useScraps } from "../context/ScrapContext";
import { openSafeUrl } from "../services/scraper";
import SmartSummaryView from "./SmartSummaryView";
import ReAnalyzeDialog from "./ReAnalyzeDialog";

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const ScrapDetailPane = ({ scrap, detailPaneTop, onClose, onTagClick }) => {
  const { togglePin, toggleRead, markRead, saveUserNote, updateScrap, deleteScrap } = useScraps();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(scrap.title || "");
  const [editTags, setEditTags] = useState(Array.isArray(scrap.tags) ? scrap.tags : []);
  const [tagInput, setTagInput] = useState("");
  const [editSummary, setEditSummary] = useState(scrap.fullSummary || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(scrap.userNote || "");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [isReAnalyzeOpen, setIsReAnalyzeOpen] = useState(false);

  const createdAt = scrap.createdAt?.toDate ? scrap.createdAt.toDate() : null;
  const dateStr = createdAt ? format(createdAt, "yyyy.MM.dd") : "Just now";
  const hostname = getHostname(scrap.url);

  const handleOpenOriginal = () => {
    markRead(scrap);
    openSafeUrl(scrap.url);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    try {
      await deleteScrap(scrap.id);
      onClose();
    } catch (error) {
      console.error(error);
      alert("An error occurred while deleting.");
    }
  };

  const handleStartEdit = () => {
    setEditTitle(scrap.title || "");
    setEditTags(Array.isArray(scrap.tags) ? scrap.tags : []);
    setTagInput("");
    setEditSummary(scrap.fullSummary || "");
    setIsEditing(true);
  };

  const addTagToken = (raw) => {
    const clean = raw.replace(/^#/, "").trim();
    if (!clean) return;
    if (editTags.length >= 10) return;
    if (editTags.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    setEditTags((prev) => [...prev, clean]);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagToken(tagInput);
      setTagInput("");
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
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
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert("Failed to update scrap.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveNote = async () => {
    if (isSavingNote) return;
    setIsSavingNote(true);
    try {
      await saveUserNote(scrap.id, noteDraft.trim());
      setIsEditingNote(false);
    } catch (error) {
      console.error(error);
      alert("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <>
      <div
        className="scrap-right-pane"
        style={{
          flex: 1.2,
          position: "sticky",
          top: `${detailPaneTop}px`,
          height: `calc(100vh - ${detailPaneTop}px - 20px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="card detail-pane-card"
          style={{
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease",
            position: "relative",
            height: "100%",
            overflow: "hidden",
            marginBottom: 0,
          }}
        >
          {/* 상단 액션 바 */}
          <div className="detail-toolbar">
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                type="button"
                className={`detail-tool-btn ${scrap.isPinned ? "active" : ""}`}
                onClick={() => togglePin(scrap)}
                title={scrap.isPinned ? "Unpin" : "Pin to top"}
              >
                <Pin size={15} />
              </button>
              <button
                type="button"
                className={`detail-tool-btn ${scrap.isRead ? "active-green" : ""}`}
                onClick={() => toggleRead(scrap)}
                title={scrap.isRead ? "Mark as unread" : "Mark as read"}
              >
                {scrap.isRead ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
              <button
                type="button"
                className={`detail-tool-btn ${isEditing ? "active" : ""}`}
                onClick={() => (isEditing ? setIsEditing(false) : handleStartEdit())}
                title="Edit title, tags & summary"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="detail-tool-btn"
                onClick={() => setIsReAnalyzeOpen(true)}
                title="Re-analyze with AI"
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                className="detail-tool-btn"
                onClick={handleOpenOriginal}
                title="Open original page"
              >
                <ExternalLink size={15} />
              </button>
              <button
                type="button"
                className="detail-tool-btn danger"
                onClick={handleDelete}
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="detail-tool-btn"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {isEditing ? (
            <form className="inline-edit-form" onSubmit={handleSaveEdit}>
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
                        aria-label={`Remove ${t}`}
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
                      onKeyDown={handleTagKeyDown}
                    />
                  )}
                </div>
              </div>

              <label className="edit-field-label" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                Summary
                <textarea
                  className="edit-summary-textarea"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  maxLength={15000}
                />
              </label>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                  onClick={() => setIsEditing(false)}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ padding: "8px 18px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  disabled={isSavingEdit}
                >
                  <Check size={14} />
                  <span>{isSavingEdit ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* 썸네일 */}
              <div style={{ flexShrink: 0 }}>
                <img
                  src={scrap.thumbnail || "/placeholder.svg"}
                  alt="thumbnail"
                  style={{
                    width: "100%",
                    height: "164px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    border: "1px solid rgba(0,0,0,0.05)",
                    display: "block",
                    cursor: "pointer",
                  }}
                  onClick={handleOpenOriginal}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.92";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onError={(e) => {
                    e.target.src = "/placeholder.svg";
                  }}
                  title="Open original page"
                  aria-label="Open original page in new tab"
                />
              </div>

              {/* 제목 + 메타 + 태그 */}
              <div style={{ flexShrink: 0, marginTop: "14px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "700", lineHeight: "1.38", margin: 0 }}>
                  {scrap.title || "Unanalyzed Scrap"}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>{dateStr}</span>
                  {hostname && (
                    <>
                      <span>·</span>
                      <span>{hostname}</span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                  {scrap.tags?.filter((t) => t && t.trim()).map((t, index) => (
                    <button
                      key={`${t}-${index}`}
                      type="button"
                      className="detail-tag-chip"
                      onClick={() => onTagClick?.(t)}
                      title={`Filter by #${t}`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 요약 + 개인 메모 스크롤 영역 */}
              <div className="detail-scroll-area">
                <SmartSummaryView scrap={scrap} />

                <div className="user-note-box">
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
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            handleSaveNote();
                          }
                        }}
                        rows={3}
                        maxLength={5000}
                        autoFocus
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
                          onClick={handleSaveNote}
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
                      Click to add a quick note or reminder...
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isReAnalyzeOpen && (
          <ReAnalyzeDialog scrap={scrap} onClose={() => setIsReAnalyzeOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default ScrapDetailPane;
