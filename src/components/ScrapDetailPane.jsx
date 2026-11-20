import React, { useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
  X,
  Pin,
  Pencil,
  RefreshCw,
  ExternalLink,
  Trash2,
  Check,
  StickyNote,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { format } from "date-fns";
import { useScraps } from "../context/ScrapContext";
import { openSafeUrl } from "../services/scraper";
import { useTranslation } from "../i18n/useTranslation";
import SmartSummaryView from "./SmartSummaryView";
import ReAnalyzeDialog from "./ReAnalyzeDialog";

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const ScrapDetailPane = ({
  scrap,
  onClose,
  onTagClick,
  isExpanded = false,
  onToggleExpand,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  currentIndex = -1,
  totalCount = 0,
}) => {
  const { togglePin, saveUserNote, updateScrap, deleteScrap } = useScraps();
  const { t } = useTranslation();

  const scrollBodyRef = useRef(null);
  const [showMiniTitle, setShowMiniTitle] = useState(false);

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
  const dateStr = createdAt ? format(createdAt, "yyyy.MM.dd") : t("common.justNow");
  const hostname = getHostname(scrap.url);
  const visibleTags = (scrap.tags || []).filter((tag) => tag && tag.trim());

  const handleBodyScroll = (e) => {
    const next = e.currentTarget.scrollTop > 88;
    setShowMiniTitle((prev) => (prev === next ? prev : next));
  };

  const handleScrollToTop = () => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const handleOpenOriginal = () => {
    openSafeUrl(scrap.url);
  };

  const handleDelete = async () => {
    if (!window.confirm(t("detail.confirmDelete"))) return;
    try {
      await deleteScrap(scrap.id);
      onClose();
    } catch (error) {
      console.error(error);
      alert(t("detail.deleteError"));
    }
  };

  const handleStartEdit = () => {
    setEditTitle(scrap.title || "");
    setEditTags(Array.isArray(scrap.tags) ? scrap.tags : []);
    setTagInput("");
    setEditSummary(scrap.fullSummary || "");
    setIsEditing(true);
    scrollBodyRef.current?.scrollTo({ top: 0 });
  };

  const addTagToken = (raw) => {
    const clean = raw.replace(/^#/, "").trim();
    if (!clean) return;
    if (editTags.length >= 10) return;
    if (editTags.some((tag) => tag.toLowerCase() === clean.toLowerCase())) return;
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
        pendingTag && editTags.length < 10 && !editTags.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase())
          ? [...editTags, pendingTag]
          : editTags;

      await updateScrap(scrap.id, {
        title: editTitle.trim() || scrap.title || t("common.untitled"),
        tags: finalTags,
        fullSummary: editSummary,
      });
      setTagInput("");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert(t("detail.updateError"));
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
      alert(t("detail.saveNoteError"));
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <>
      <div className="scrap-right-pane">
        <div
          className={`card detail-pane-card ${isExpanded ? "expanded" : ""}`}
          style={{ animation: "fadeIn 0.15s ease" }}
        >
          {/* 상단 고정 슬림 툴바 */}
          <div className="detail-toolbar">
            <div className="detail-toolbar-left">
              <div className="detail-nav-group">
                <button
                  type="button"
                  className="detail-tool-btn"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  title={t("detail.prevScrap")}
                  aria-label={t("detail.prevScrap")}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  className="detail-tool-btn"
                  onClick={onNext}
                  disabled={!hasNext}
                  title={t("detail.nextScrap")}
                  aria-label={t("detail.nextScrap")}
                >
                  <ChevronDown size={15} />
                </button>
                {currentIndex >= 0 && totalCount > 0 && (
                  <span className="detail-nav-counter">
                    {currentIndex + 1} / {totalCount}
                  </span>
                )}
              </div>

              <span className="detail-toolbar-divider" />

              <div className="detail-action-group">
                <button
                  type="button"
                  className={`detail-tool-btn ${scrap.isPinned ? "active" : ""}`}
                  onClick={() => togglePin(scrap)}
                  title={scrap.isPinned ? t("common.unpin") : t("common.pinToTop")}
                >
                  <Pin size={15} />
                </button>
                <button
                  type="button"
                  className={`detail-tool-btn ${isEditing ? "active" : ""}`}
                  onClick={() => (isEditing ? setIsEditing(false) : handleStartEdit())}
                  title={t("detail.editTooltip")}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="detail-tool-btn"
                  onClick={() => setIsReAnalyzeOpen(true)}
                  title={t("detail.reAnalyzeAiTooltip")}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  className="detail-tool-btn"
                  onClick={handleOpenOriginal}
                  title={t("common.openOriginal")}
                >
                  <ExternalLink size={15} />
                </button>
                <button
                  type="button"
                  className="detail-tool-btn danger"
                  onClick={handleDelete}
                  title={t("common.delete")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="detail-toolbar-center">
              <button
                type="button"
                className={`detail-toolbar-mini-title ${showMiniTitle && !isEditing ? "visible" : ""}`}
                onClick={handleScrollToTop}
                title={t("detail.scrollToTop")}
                tabIndex={showMiniTitle && !isEditing ? 0 : -1}
              >
                {scrap.title || t("common.unanalyzedScrap")}
              </button>
            </div>

            <div className="detail-toolbar-right">
              {onToggleExpand && (
                <button
                  type="button"
                  className={`detail-tool-btn ${isExpanded ? "active" : ""}`}
                  onClick={onToggleExpand}
                  title={isExpanded ? t("detail.collapseView") : t("detail.expandView")}
                  aria-label={isExpanded ? t("detail.collapseView") : t("detail.expandView")}
                  aria-pressed={isExpanded}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="detail-tool-btn"
                title={t("common.close")}
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 통합 스크롤 본문 (컴팩트 헤더 + 스마트 요약 + 개인 메모) */}
          <div ref={scrollBodyRef} className="detail-scroll-body" onScroll={handleBodyScroll}>
            <div className="detail-body-inner">
              {isEditing ? (
                <form className="inline-edit-form" onSubmit={handleSaveEdit}>
                  <label className="edit-field-label">
                    {t("detail.titleLabel")}
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={500}
                      required
                    />
                  </label>

                  <div className="edit-field-label">
                    {t("detail.tagsLabel", { count: editTags.length })}
                    <div className="edit-tags-container">
                      {editTags.map((tag, idx) => (
                        <span key={`${tag}-${idx}`} className="edit-tag-pill">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setEditTags((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label={t("detail.removeTag", { tag })}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                      {editTags.length < 10 && (
                        <input
                          type="text"
                          className="edit-tag-input"
                          placeholder={t("detail.addTagPlaceholder")}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                        />
                      )}
                    </div>
                  </div>

                  <label className="edit-field-label" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {t("detail.summaryLabel")}
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
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="btn"
                      style={{ padding: "8px 18px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      disabled={isSavingEdit}
                    >
                      <Check size={14} />
                      <span>{isSavingEdit ? t("common.saving") : t("common.save")}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* 컴팩트 16:9 가로형 헤더 */}
                  <header className="detail-hero-header">
                    <button
                      type="button"
                      className="detail-hero-thumb-btn"
                      onClick={handleOpenOriginal}
                      title={t("common.openOriginal")}
                      aria-label={t("common.openOriginalNewTab")}
                    >
                      <img
                        src={scrap.thumbnail || "/placeholder.svg"}
                        alt={scrap.title || "thumbnail"}
                        className="detail-hero-thumb"
                        onError={(e) => {
                          e.target.src = "/placeholder.svg";
                        }}
                      />
                      <span className="detail-hero-thumb-badge" aria-hidden="true">
                        <ExternalLink size={12} />
                      </span>
                    </button>

                    <div className="detail-hero-info">
                      <h2 className="detail-hero-title">
                        {scrap.title || t("common.unanalyzedScrap")}
                      </h2>
                      <div className="detail-hero-meta">
                        <span>{dateStr}</span>
                        {hostname && (
                          <>
                            <span>·</span>
                            <button
                              type="button"
                              className="detail-hero-host-link"
                              onClick={handleOpenOriginal}
                              title={t("common.openOriginal")}
                            >
                              <span>{hostname}</span>
                              <ExternalLink size={11} />
                            </button>
                          </>
                        )}
                      </div>
                      {visibleTags.length > 0 && (
                        <div className="detail-hero-tags">
                          {visibleTags.map((tag, index) => (
                            <button
                              key={`${tag}-${index}`}
                              type="button"
                              className="detail-tag-chip"
                              onClick={() => onTagClick?.(tag)}
                              title={t("detail.filterByTag", { tag })}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </header>

                  {/* 요약 + 개인 메모 */}
                  <div className="detail-content-stack">
                    <SmartSummaryView scrap={scrap} />

                    <div className="user-note-box">
                      <div className="user-note-header">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <StickyNote size={13} />
                          <span>{t("detail.myNote")}</span>
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
                            {scrap.userNote ? t("common.edit") : t("detail.addNoteBtn")}
                          </button>
                        )}
                      </div>

                      {isEditingNote ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <textarea
                            className="user-note-textarea"
                            placeholder={t("detail.notePlaceholder")}
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
                              {t("common.cancel")}
                            </button>
                            <button
                              type="button"
                              className="user-note-save-btn"
                              onClick={handleSaveNote}
                              disabled={isSavingNote}
                            >
                              {isSavingNote ? t("common.saving") : t("detail.saveNote")}
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
                          {t("detail.noteEmptyDesktop")}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
