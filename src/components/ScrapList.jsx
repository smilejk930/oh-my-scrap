import React, { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from "react";
import { useScraps } from "../context/ScrapContext";
import { useTranslation } from "../i18n/useTranslation";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, startOfDay } from "date-fns";

const ScrapList = ({ viewMode, setViewMode, onAddClick, selectedScrapId, setSelectedScrapId }) => {
  const { scraps, loading } = useScraps();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("all");
  const [selectedTag, setSelectedTag] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pinned'
  const [showAllTags, setShowAllTags] = useState(false);
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [mobileExpandedId, setMobileExpandedId] = useState(null);
  const [mobileFocusTick, setMobileFocusTick] = useState(0);
  const prevMobileExpandedIdRef = useRef(null);
  const forceMobileScrollIdRef = useRef(null);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const searchHeaderRef = useRef(null);
  const tagBarRef = useRef(null);
  const [detailPaneTop, setDetailPaneTop] = useState(140);
  const [tagScrollState, setTagScrollState] = useState({ canLeft: false, canRight: false });

  useEffect(() => {
    const update = () => {
      setIsDesktop(window.innerWidth >= 768);
      if (searchHeaderRef.current) {
        setDetailPaneTop(searchHeaderRef.current.offsetHeight + 10);
      }
    };
    const rafId = requestAnimationFrame(update);
    window.addEventListener("resize", update);

    let observer;
    if (typeof ResizeObserver !== "undefined" && searchHeaderRef.current) {
      observer = new ResizeObserver(update);
      observer.observe(searchHeaderRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [loading, scraps.length, showAllTags]);

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

  // PC 마우스 휠 가로 스크롤 및 좌/우 오버플로 화살표 상태 동기화
  useEffect(() => {
    const el = tagBarRef.current;
    if (!el) return undefined;

    const updateScrollState = () => {
      if (showAllTags) {
        setTagScrollState((prev) =>
          prev.canLeft || prev.canRight ? { canLeft: false, canRight: false } : prev
        );
        return;
      }
      const canLeft = el.scrollLeft > 4;
      const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setTagScrollState((prev) =>
        prev.canLeft === canLeft && prev.canRight === canRight ? prev : { canLeft, canRight }
      );
    };

    const handleWheel = (e) => {
      if (showAllTags || el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    const rafId = requestAnimationFrame(updateScrollState);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    el.addEventListener("wheel", handleWheel, { passive: false });

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateScrollState);
      observer.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", updateScrollState);
      el.removeEventListener("wheel", handleWheel);
      observer?.disconnect();
    };
  }, [loading, tagStats.length, showAllTags, isDesktop]);

  const pinnedCount = useMemo(
    () => scraps.filter((s) => Boolean(s.isPinned)).length,
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

      // 3. 상태 필터 (핀 고정)
      if (statusFilter === "pinned" && !scrap.isPinned) return false;

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

  const filteredScrapsRef = useRef(filteredScraps);

  useLayoutEffect(() => {
    filteredScrapsRef.current = filteredScraps;
  }, [filteredScraps]);

  useLayoutEffect(() => {
    const prevId = prevMobileExpandedIdRef.current;
    const isForcedFocus =
      Boolean(mobileExpandedId) && forceMobileScrollIdRef.current === mobileExpandedId;

    if (prevId === mobileExpandedId && !isForcedFocus) {
      return;
    }
    prevMobileExpandedIdRef.current = mobileExpandedId;

    if (isDesktop || viewMode !== "list" || !mobileExpandedId) {
      forceMobileScrollIdRef.current = null;
      return;
    }

    const el = document.getElementById(`scrap-item-${mobileExpandedId}`);
    const headerEl = searchHeaderRef.current;
    if (!el || !headerEl) {
      forceMobileScrollIdRef.current = null;
      return;
    }

    forceMobileScrollIdRef.current = null;

    const stickyTop = parseFloat(window.getComputedStyle(headerEl).top) || 0;
    const stuckHeaderBottom = stickyTop + headerEl.offsetHeight;
    const currentHeaderBottom = headerEl.getBoundingClientRect().bottom;
    const gap = 6;
    const desiredTop = stuckHeaderBottom + gap;

    const rect = el.getBoundingClientRect();
    const bottomNav = document.querySelector("nav.mobile-only");
    const bottomNavHeight = bottomNav ? bottomNav.offsetHeight : 72;
    const usableBottom = window.innerHeight - bottomNavHeight - 12;

    const list = filteredScrapsRef.current;
    const prevIndex = prevId ? list.findIndex((s) => s.id === prevId) : -1;
    const nextIndex = list.findIndex((s) => s.id === mobileExpandedId);
    const collapsedAbove = prevIndex !== -1 && nextIndex !== -1 && prevIndex < nextIndex;
    const hadPrevExpanded = prevIndex !== -1 && prevId !== mobileExpandedId;

    const isTopObscured = rect.top < currentHeaderBottom + 4 || rect.top < desiredTop;
    const isLongOverflowing = rect.bottom > usableBottom;
    const isOpenedLowOnScreen = rect.top > window.innerHeight * 0.5 && isLongOverflowing;

    const shouldScrollToHeader =
      isForcedFocus ||
      isTopObscured ||
      (hadPrevExpanded && isLongOverflowing) ||
      isOpenedLowOnScreen;

    if (!shouldScrollToHeader) return;

    const targetScrollY = Math.max(0, Math.round(window.scrollY + rect.top - desiredTop));
    const shouldJumpInstantly = !isForcedFocus && (collapsedAbove || isTopObscured);

    if (shouldJumpInstantly) {
      window.scrollTo(0, targetScrollY);
    } else {
      window.scrollTo({ top: targetScrollY, behavior: "smooth" });
    }
  }, [mobileExpandedId, isDesktop, viewMode, mobileFocusTick]);

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
        forceMobileScrollIdRef.current = scrap.id;
        setMobileExpandedId(scrap.id);
        setMobileFocusTick((n) => n + 1);
        return;
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
          top: 0,
          zIndex: 10,
          background: "var(--bg-color)",
          paddingTop: "10px",
          marginTop: "-10px",
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
            placeholder={t("list.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="search-right-actions">
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                title={t("list.clearSearch")}
                aria-label={t("list.clearSearch")}
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className="ask-ai-btn"
              onClick={() => setIsAskOpen(true)}
              title={t("list.askAiTitle")}
            >
              <Sparkles size={14} />
              <span>{t("list.askAi")}</span>
            </button>
          </div>
        </div>

        {/* Row 1: 날짜 + 상태 필터 + 뷰 전환/추가 */}
        <div className="flex-between" style={{ gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", alignItems: "center", paddingBottom: "2px" }}>
            {[
              { key: "all", labelKey: "list.filterAll" },
              { key: "today", labelKey: "list.filterToday" },
              { key: "week", labelKey: "list.filterWeek" },
              { key: "month", labelKey: "list.filterMonth" },
              { key: "older", labelKey: "list.filterOlder" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`filter-pill ${filterDate === f.key ? "active" : ""}`}
                onClick={() => setFilterDate(f.key)}
              >
                {t(f.labelKey)}
              </button>
            ))}

            <span className="filter-divider" />

            <button
              type="button"
              className={`filter-pill icon ${statusFilter === "pinned" ? "active" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "pinned" ? "all" : "pinned"))}
            >
              <Pin size={12} />
              <span>{t("common.pinned")}</span>
              {pinnedCount > 0 && <span className="pill-count">{pinnedCount}</span>}
            </button>
          </div>

          <div className="desktop-only" style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "5px", background: "rgba(0,0,0,0.05)", padding: "4px", borderRadius: "10px" }}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{ background: viewMode === "list" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
                title={t("nav.listView")}
              >
                <ListIcon size={18} color={viewMode === "list" ? "#0071E3" : "#86868B"} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("card")}
                style={{ background: viewMode === "card" ? "white" : "none", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", display: "flex" }}
                title={t("nav.cardView")}
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
                title={t("nav.addScrap")}
              >
                <Plus size={16} />
                <span>{t("nav.add")}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Row 2: 클릭형 태그 클라우드 필터 바 (PC 화살표·휠 스크롤 & 전체 펼치기 지원) */}
        {tagStats.length > 0 && (
          <div className="tag-filter-wrapper">
            <div className="tag-filter-track">
              {!showAllTags && tagScrollState.canLeft && (
                <button
                  type="button"
                  className="tag-scroll-btn left desktop-only"
                  onClick={() => tagBarRef.current?.scrollBy({ left: -260, behavior: "smooth" })}
                  title={t("list.scrollTagsLeft")}
                  aria-label={t("list.scrollTagsLeft")}
                >
                  <ChevronLeft size={15} />
                </button>
              )}

              <div
                ref={tagBarRef}
                className={`tag-filter-bar ${showAllTags ? "expanded" : ""}`}
              >
                <button
                  type="button"
                  className={`tag-chip ${!selectedTag ? "active" : ""}`}
                  onClick={() => setSelectedTag(null)}
                >
                  {t("list.allTags")}
                </button>
                {tagStats.map((tItem) => {
                  const isActive = selectedTag?.toLowerCase() === tItem.lower;
                  return (
                    <button
                      key={tItem.lower}
                      type="button"
                      className={`tag-chip ${isActive ? "active" : ""}`}
                      onClick={() => handleTagClick(tItem.label)}
                    >
                      <span>#{tItem.label}</span>
                      <span className="tag-chip-count">{tItem.count}</span>
                    </button>
                  );
                })}
              </div>

              {!showAllTags && tagScrollState.canRight && (
                <button
                  type="button"
                  className="tag-scroll-btn right desktop-only"
                  onClick={() => tagBarRef.current?.scrollBy({ left: 260, behavior: "smooth" })}
                  title={t("list.scrollTagsRight")}
                  aria-label={t("list.scrollTagsRight")}
                >
                  <ChevronRight size={15} />
                </button>
              )}
            </div>

            {(tagScrollState.canLeft || tagScrollState.canRight || showAllTags) && (
              <button
                type="button"
                className={`tag-expand-btn ${showAllTags ? "active" : ""}`}
                onClick={() => setShowAllTags((prev) => !prev)}
                title={showAllTags ? t("list.collapseTags") : t("list.showAllTags")}
              >
                {showAllTags ? (
                  <>
                    <ChevronUp size={13} />
                    <span>{t("list.less")}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} />
                    <span>{t("list.allWithCount", { count: tagStats.length })}</span>
                  </>
                )}
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
          {t("list.empty")}
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
