import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useScraps } from "../context/ScrapContext";
import ScrapItem from "./ScrapItem";
import ScrapDetailPane from "./ScrapDetailPane";
import RediscoverBanner from "./RediscoverBanner";
import AskArchiveModal from "./AskArchiveModal";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  X,
  Loader2,
  Plus,
  Sparkles,
  Pin,
  CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, startOfDay } from "date-fns";

const ScrapList = ({ viewMode, setViewMode, onAddClick, selectedScrapId, setSelectedScrapId }) => {
  const { scraps, loading } = useScraps();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("all");
  const [selectedTag, setSelectedTag] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pinned' | 'unread'
  const [showAllTags, setShowAllTags] = useState(false);
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [mobileExpandedId, setMobileExpandedId] = useState(null);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const searchHeaderRef = useRef(null);
  const [detailPaneTop, setDetailPaneTop] = useState(140);

  useEffect(() => {
    const update = () => {
      setIsDesktop(window.innerWidth >= 768);
      if (searchHeaderRef.current) {
        setDetailPaneTop(searchHeaderRef.current.offsetHeight + 20);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [scraps.length, showAllTags]);

  const selectedScrap = useMemo(
    () => scraps.find((s) => s.id === selectedScrapId) || null,
    [scraps, selectedScrapId]
  );

  // 전체 스크랩에서 태그 집계 (빈도순 정렬)
  const tagStats = useMemo(() => {
    const counts = new Map();
    for (const scrap of scraps) {
      const seenInItem = new Set();
      for (const rawTag of scrap.tags || []) {
        const clean = rawTag?.trim();
        if (!clean) continue;
        const lower = clean.toLowerCase();
        if (seenInItem.has(lower)) continue;
        seenInItem.add(lower);

        const existing = counts.get(lower);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(lower, { label: clean, lower, count: 1 });
        }
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [scraps]);

  const pinnedCount = useMemo(
    () => scraps.filter((s) => Boolean(s.isPinned)).length,
    [scraps]
  );
  const unreadCount = useMemo(
    () => scraps.filter((s) => s.isRead !== true).length,
    [scraps]
  );

  // 필터링 + 검색 + 핀 고정 우선 정렬
  const filteredScraps = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    const selectedTagLower = selectedTag ? selectedTag.toLowerCase() : null;
    const now = new Date();

    const matched = scraps.filter((scrap) => {
      // 1. 검색어 필터 (제목, 요약, 태그, 개인 메모)
      const matchesSearch =
        !searchLower ||
        scrap.title?.toLowerCase().includes(searchLower) ||
        scrap.fullSummary?.toLowerCase().includes(searchLower) ||
        scrap.userNote?.toLowerCase().includes(searchLower) ||
        scrap.tags?.some((tag) => tag.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // 2. 태그 필터
      if (selectedTagLower) {
        const hasTag = scrap.tags?.some((t) => t?.trim().toLowerCase() === selectedTagLower);
        if (!hasTag) return false;
      }

      // 3. 상태 필터 (핀 고정 / 안 읽음)
      if (statusFilter === "pinned" && !scrap.isPinned) return false;
      if (statusFilter === "unread" && scrap.isRead === true) return false;

      // 4. 날짜 필터
      if (filterDate !== "all") {
        const createdAt = scrap.createdAt?.toDate ? scrap.createdAt.toDate() : null;
        if (!createdAt) return false;
        if (filterDate === "today" && createdAt < startOfDay(now)) return false;
        if (filterDate === "week" && createdAt < startOfDay(subDays(now, 7))) return false;
        if (filterDate === "month" && createdAt < startOfDay(subDays(now, 30))) return false;
        if (filterDate === "older" && createdAt >= startOfDay(subDays(now, 30))) return false;
      }

      return true;
    });

    // 핀 고정 항목 최상단 정렬 (각 그룹 내 최신순 유지)
    return matched.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [scraps, searchTerm, selectedTag, statusFilter, filterDate]);

  const handleTagClick = useCallback((tag) => {
    if (!tag) return;
    setSelectedTag((prev) =>
      prev && prev.toLowerCase() === tag.toLowerCase() ? null : tag
    );
  }, []);

  const handleFocusScrap = useCallback(
    (scrap) => {
      if (!scrap) return;
      setSearchTerm("");
      setSelectedTag(null);
      setFilterDate("all");
      setStatusFilter("all");
      setSelectedScrapId(scrap.id);
      if (!isDesktop) {
        if (viewMode === "card") {
          setViewMode("list");
        }
        setMobileExpandedId(scrap.id);
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`scrap-item-${scrap.id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [isDesktop, setSelectedScrapId, setViewMode, viewMode]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px", color: "var(--accent-color)" }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const visibleTags = showAllTags ? tagStats : tagStats.slice(0, 12);
  const isDefaultView =
    !searchTerm.trim() && !selectedTag && filterDate === "all" && statusFilter === "all";

  return (
    <div className="flex-column" style={{ gap: "18px" }}>
      {/* Search, Filters & Tag Cloud */}
      <div
        ref={searchHeaderRef}
        className="flex-column"
        style={{
          position: "sticky",
          top: "10px",
          zIndex: 10,
          background: "var(--bg-color)",
          paddingBottom: "10px",
        }}
      >
        {/* 검색 바 + Ask AI */}
        <div className="search-bar-wrapper">
          <Search
            size={18}
            style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#86868B", pointerEvents: "none" }}
          />
          <input
            className="search-input-with-actions"
            placeholder="Search title, tags, summary, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="search-right-actions">
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className="ask-ai-btn"
              onClick={() => setIsAskOpen(true)}
              title="Ask AI across your scraps"
            >
              <Sparkles size={14} />
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* Row 1: 날짜 + 상태 필터 + 뷰 전환/추가 */}
        <div className="flex-between" style={{ gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", alignItems: "center", paddingBottom: "2px" }}>
            {["all", "today", "week", "month", "older"].map((f) => (
              <button
                key={f}
                type="button"
                className={`filter-pill ${filterDate === f ? "active" : ""}`}
                onClick={() => setFilterDate(f)}
              >
                {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "Week" : f === "month" ? "Month" : "Older"}
              </button>
            ))}

            <span className="filter-divider" />

            <button
              type="button"
              className={`filter-pill icon ${statusFilter === "pinned" ? "active" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "pinned" ? "all" : "pinned"))}
            >
              <Pin size={12} />
              <span>Pinned</span>
              {pinnedCount > 0 && <span className="pill-count">{pinnedCount}</span>}
            </button>
            <button
              type="button"
              className={`filter-pill icon ${statusFilter === "unread" ? "active" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "unread" ? "all" : "unread"))}
            >
              <CircleDot size={12} />
              <span>Unread</span>
              {unreadCount > 0 && <span className="pill-count">{unreadCount}</span>}
            </button>
          </div>

          <div className="desktop-only" style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "5px", background: "rgba(0,0,0,0.05)", padding: "4px", borderRadius: "10px" }}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{ background: viewMode === "list" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
                title="List view"
              >
                <ListIcon size={18} color={viewMode === "list" ? "#0071E3" : "#86868B"} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("card")}
                style={{ background: viewMode === "card" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
                title="Card view"
              >
                <LayoutGrid size={18} color={viewMode === "card" ? "#0071E3" : "#86868B"} />
              </button>
            </div>
            {onAddClick && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onAddClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "20px",
                  border: "none",
                  background: "var(--accent-color)",
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0,113,227,0.3)",
                  flexShrink: 0,
                }}
                title="Add Scrap"
              >
                <Plus size={16} />
                <span>Add</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Row 2: 클릭형 태그 클라우드 필터 바 */}
        {tagStats.length > 0 && (
          <div className="tag-filter-bar">
            <button
              type="button"
              className={`tag-chip ${!selectedTag ? "active" : ""}`}
              onClick={() => setSelectedTag(null)}
            >
              All Tags
            </button>
            {visibleTags.map((t) => {
              const isActive = selectedTag?.toLowerCase() === t.lower;
              return (
                <button
                  key={t.lower}
                  type="button"
                  className={`tag-chip ${isActive ? "active" : ""}`}
                  onClick={() => handleTagClick(t.label)}
                >
                  <span>#{t.label}</span>
                  <span className="tag-chip-count">{t.count}</span>
                </button>
              );
            })}
            {tagStats.length > 12 && (
              <button
                type="button"
                className="tag-chip tag-chip-more"
                onClick={() => setShowAllTags((prev) => !prev)}
              >
                {showAllTags ? "Less" : `+${tagStats.length - 12} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 타임캡슐 / 랜덤 재발견 배너 */}
      {isDefaultView && (
        <RediscoverBanner scraps={scraps} onSelectScrap={handleFocusScrap} />
      )}

      {filteredScraps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#86868B" }}>
          No scraps found.
        </div>
      ) : (
        <div className="scrap-container" style={{ display: isDesktop ? "flex" : "block", gap: "20px" }}>
          <div
            className="scrap-left-pane"
            style={{
              flex: isDesktop && selectedScrap ? 1 : "auto",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div className={viewMode === "list" ? "scrap-list" : "scrap-grid"}>
              {filteredScraps.map((scrap) => (
                <ScrapItem
                  key={scrap.id}
                  scrap={scrap}
                  mode={viewMode}
                  isDesktop={isDesktop}
                  isSelected={selectedScrap?.id === scrap.id}
                  onSelect={() => setSelectedScrapId(scrap.id)}
                  onDelete={(id) => {
                    if (selectedScrapId === id) {
                      setSelectedScrapId(null);
                    }
                    if (mobileExpandedId === id) {
                      setMobileExpandedId(null);
                    }
                  }}
                  onTagClick={handleTagClick}
                  isMobileExpanded={mobileExpandedId === scrap.id}
                  onToggleMobileExpand={() =>
                    setMobileExpandedId((prev) => (prev === scrap.id ? null : scrap.id))
                  }
                />
              ))}
            </div>
          </div>

          {isDesktop && selectedScrap && (
            <ScrapDetailPane
              key={selectedScrap.id}
              scrap={selectedScrap}
              detailPaneTop={detailPaneTop}
              onClose={() => setSelectedScrapId(null)}
              onTagClick={handleTagClick}
            />
          )}
        </div>
      )}

      <AnimatePresence>
        {isAskOpen && (
          <AskArchiveModal
            onClose={() => setIsAskOpen(false)}
            onSelectScrap={handleFocusScrap}
            initialQuestion={searchTerm}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScrapList;
