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

const DESKTOP_BREAKPOINT = 769;
const DEFAULT_LIST_WIDTH = 370;
const MIN_LIST_WIDTH = 280;
const MAX_LIST_WIDTH = 560;
const MIN_DETAIL_WIDTH = 420;
const RESIZER_WIDTH = 14;
const LIST_WIDTH_STORAGE_KEY = "oms_desktop_list_width";

const readStoredListWidth = () => {
  if (typeof window === "undefined") return DEFAULT_LIST_WIDTH;
  try {
    const raw = Number(window.localStorage.getItem(LIST_WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= MIN_LIST_WIDTH && raw <= MAX_LIST_WIDTH) {
      return raw;
    }
  } catch {
    // ignore storage failures
  }
  return DEFAULT_LIST_WIDTH;
};

const ScrapList = ({
  viewMode,
  setViewMode,
  onAddClick,
  selectedScrapId,
  setSelectedScrapId,
  desktopHeaderActions,
}) => {
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
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : true
  );
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [listPaneWidth, setListPaneWidth] = useState(readStoredListWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [splitContainerWidth, setSplitContainerWidth] = useState(0);

  const searchHeaderRef = useRef(null);
  const tagBarRef = useRef(null);
  const splitBodyRef = useRef(null);
  const leftPaneRef = useRef(null);
  const [tagScrollState, setTagScrollState] = useState({ canLeft: false, canRight: false });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop || loading) return undefined;
    const el = splitBodyRef.current;
    if (!el) return undefined;

    const updateWidth = () => {
      const next = el.clientWidth;
      setSplitContainerWidth((prev) => (prev === next ? prev : next));
    };

    const rafId = requestAnimationFrame(updateWidth);
    window.addEventListener("resize", updateWidth);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateWidth);
      observer.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateWidth);
      observer?.disconnect();
    };
  }, [isDesktop, loading]);

  const selectedScrap = useMemo(
    () => scraps.find((s) => s.id === selectedScrapId) || null,
    [scraps, selectedScrapId]
  );

  const effectiveDetailExpanded = Boolean(isDesktop && selectedScrap && isDetailExpanded);

  const maxAllowedListWidth =
    splitContainerWidth > 0
      ? Math.max(
          MIN_LIST_WIDTH,
          Math.min(MAX_LIST_WIDTH, splitContainerWidth - MIN_DETAIL_WIDTH - RESIZER_WIDTH)
        )
      : MAX_LIST_WIDTH;

  const effectiveListWidth = Math.min(Math.max(listPaneWidth, MIN_LIST_WIDTH), maxAllowedListWidth);

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
  }, [loading, tagStats.length, showAllTags, isDesktop, effectiveDetailExpanded]);

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
        const hasTag = scrap.tags?.some((tag) => tag?.trim().toLowerCase() === selectedTagLower);
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

  const selectedIndex = useMemo(
    () => (selectedScrap ? filteredScraps.findIndex((s) => s.id === selectedScrap.id) : -1),
    [filteredScraps, selectedScrap]
  );

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < filteredScraps.length - 1;

  const selectScrapAndReveal = useCallback(
    (scrapId, block = "nearest") => {
      if (!scrapId) return;
      setSelectedScrapId(scrapId);
      requestAnimationFrame(() => {
        const el = document.getElementById(`scrap-item-${scrapId}`);
        el?.scrollIntoView({ behavior: "smooth", block });
      });
    },
    [setSelectedScrapId]
  );

  const handlePrevScrap = useCallback(() => {
    if (selectedIndex > 0) {
      selectScrapAndReveal(filteredScraps[selectedIndex - 1].id);
    }
  }, [filteredScraps, selectedIndex, selectScrapAndReveal]);

  const handleNextScrap = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < filteredScraps.length - 1) {
      selectScrapAndReveal(filteredScraps[selectedIndex + 1].id);
    } else if (selectedIndex === -1 && filteredScraps.length > 0) {
      selectScrapAndReveal(filteredScraps[0].id);
    }
  }, [filteredScraps, selectedIndex, selectScrapAndReveal]);

  const handleCloseDetail = useCallback(() => {
    setIsDetailExpanded(false);
    setSelectedScrapId(null);
  }, [setSelectedScrapId]);

  const handleSearchChange = useCallback(
    (nextValue) => {
      setSearchTerm(nextValue);
      if (isDetailExpanded && nextValue.trim()) {
        setIsDetailExpanded(false);
      }
    },
    [isDetailExpanded]
  );

  const handleTagClick = useCallback((tag) => {
    if (!tag) return;
    setSelectedTag((prev) =>
      prev && prev.toLowerCase() === tag.toLowerCase() ? null : tag
    );
    setIsDetailExpanded(false);
  }, []);

  const handleFocusScrap = useCallback(
    (scrap) => {
      if (!scrap) return;
      setSearchTerm("");
      setSelectedTag(null);
      setFilterDate("all");
      setStatusFilter("all");
      setIsDetailExpanded(false);
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

  // PC 데스크톱 키보드 탐색 (↑/↓ 이전·다음 이동, Esc 축소/닫기)
  useEffect(() => {
    if (!isDesktop || !selectedScrap || isAskOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active?.isContentEditable
      ) {
        return;
      }
      if (document.querySelector(".dialog-overlay")) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        handleNextScrap();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevScrap();
      } else if (e.key === "Escape") {
        if (isDetailExpanded) {
          setIsDetailExpanded(false);
        } else {
          setSelectedScrapId(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isDesktop,
    selectedScrap,
    isAskOpen,
    isDetailExpanded,
    handleNextScrap,
    handlePrevScrap,
    setSelectedScrapId,
  ]);

  const persistListWidth = useCallback((width) => {
    try {
      window.localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(Math.round(width)));
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSplitterPointerDown = useCallback(
    (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const bodyEl = splitBodyRef.current;
      if (!bodyEl) return;

      e.preventDefault();
      const bodyRect = bodyEl.getBoundingClientRect();
      const maxWidth = Math.max(
        MIN_LIST_WIDTH,
        Math.min(MAX_LIST_WIDTH, bodyRect.width - MIN_DETAIL_WIDTH - RESIZER_WIDTH)
      );

      let latestWidth = effectiveListWidth;
      setIsResizing(true);
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMove = (moveEvent) => {
        const rawWidth = moveEvent.clientX - bodyRect.left;
        const clamped = Math.round(Math.min(Math.max(rawWidth, MIN_LIST_WIDTH), maxWidth));
        latestWidth = clamped;
        setListPaneWidth(clamped);
      };

      const finish = () => {
        setIsResizing(false);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        window.removeEventListener("blur", finish);
        persistListWidth(latestWidth);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      window.addEventListener("blur", finish);
    },
    [effectiveListWidth, persistListWidth]
  );

  const handleSplitterDoubleClick = useCallback(() => {
    const resetWidth = Math.min(DEFAULT_LIST_WIDTH, maxAllowedListWidth);
    setListPaneWidth(resetWidth);
    persistListWidth(resetWidth);
  }, [maxAllowedListWidth, persistListWidth]);

  const handleSplitterKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = Math.max(MIN_LIST_WIDTH, effectiveListWidth - 20);
        setListPaneWidth(next);
        persistListWidth(next);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(maxAllowedListWidth, effectiveListWidth + 20);
        setListPaneWidth(next);
        persistListWidth(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        handleSplitterDoubleClick();
      }
    },
    [effectiveListWidth, maxAllowedListWidth, persistListWidth, handleSplitterDoubleClick]
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

  const renderSearchBar = (extraClass = "") => (
    <div className={`search-bar-wrapper ${extraClass}`.trim()}>
      <Search
        size={18}
        style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#86868B", pointerEvents: "none" }}
      />
      <input
        className="search-input-with-actions"
        placeholder={t("list.searchPlaceholder")}
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
      />
      <div className="search-right-actions">
        {searchTerm && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => handleSearchChange("")}
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
  );

  const renderDateAndStatusPills = () => (
    <div style={{ display: "flex", gap: "6px", overflowX: "auto", alignItems: "center", paddingBottom: "2px", minWidth: 0 }}>
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
  );

  const renderTagFilterBar = () => {
    if (tagStats.length === 0) return null;
    return (
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
    );
  };

  if (isDesktop) {
    return (
      <div
        className={`scrap-workspace ${selectedScrap ? "has-detail" : ""} ${
          effectiveDetailExpanded ? "is-focus-mode" : ""
        }`}
      >
        {/* 고정 상단 데스크톱 크롬 (헤더 + 검색 + 필터) */}
        <div className="desktop-chrome">
          <div className="desktop-top-bar">
            <h1 className="desktop-brand-title">Oh My Scrap</h1>

            {renderSearchBar("desktop-search-bar")}

            <div className="desktop-top-controls">
              <div className="desktop-view-toggle">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`desktop-view-btn ${viewMode === "list" ? "active" : ""}`}
                  title={t("nav.listView")}
                  aria-label={t("nav.listView")}
                >
                  <ListIcon size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("card")}
                  className={`desktop-view-btn ${viewMode === "card" ? "active" : ""}`}
                  title={t("nav.cardView")}
                  aria-label={t("nav.cardView")}
                >
                  <LayoutGrid size={17} />
                </button>
              </div>

              {onAddClick && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={onAddClick}
                  className="desktop-add-btn"
                  title={t("nav.addScrap")}
                >
                  <Plus size={15} />
                  <span>{t("nav.add")}</span>
                </motion.button>
              )}

              {desktopHeaderActions}
            </div>
          </div>

          {!effectiveDetailExpanded && (
            <div className="desktop-filter-rows">
              {renderDateAndStatusPills()}
              {renderTagFilterBar()}
            </div>
          )}
        </div>

        {/* 독립 스크롤 2단 분할 본문 */}
        <div
          ref={splitBodyRef}
          className={`scrap-split-body ${selectedScrap ? "is-split" : ""} ${
            isResizing ? "is-resizing" : ""
          }`}
        >
          <div
            ref={leftPaneRef}
            className={`scrap-left-pane ${selectedScrap ? "is-split-list" : ""} ${
              effectiveDetailExpanded ? "is-hidden" : ""
            }`}
            style={
              selectedScrap && !effectiveDetailExpanded
                ? { width: `${effectiveListWidth}px`, flexBasis: `${effectiveListWidth}px` }
                : undefined
            }
          >
            {isDefaultView && (
              <RediscoverBanner scraps={scraps} onSelectScrap={handleFocusScrap} />
            )}

            {filteredScraps.length === 0 ? (
              <div className="scrap-empty-state">{t("list.empty")}</div>
            ) : (
              <div
                className={
                  viewMode === "list"
                    ? "scrap-list"
                    : `scrap-grid ${selectedScrap ? "split-active" : ""}`
                }
              >
                {filteredScraps.map((scrap) => (
                  <ScrapItem
                    key={scrap.id}
                    scrap={scrap}
                    mode={viewMode}
                    isDesktop
                    isCompactSplit={Boolean(selectedScrap)}
                    isSelected={selectedScrap?.id === scrap.id}
                    onSelect={() => setSelectedScrapId(scrap.id)}
                    onDelete={(id) => {
                      if (selectedScrapId === id) {
                        setIsDetailExpanded(false);
                        setSelectedScrapId(null);
                      }
                      if (mobileExpandedId === id) {
                        setMobileExpandedId(null);
                      }
                    }}
                    onTagClick={handleTagClick}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedScrap && !effectiveDetailExpanded && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("detail.resizePane")}
              aria-valuemin={MIN_LIST_WIDTH}
              aria-valuemax={maxAllowedListWidth}
              aria-valuenow={effectiveListWidth}
              tabIndex={0}
              className={`split-resizer ${isResizing ? "active" : ""}`}
              title={t("detail.resizePane")}
              onPointerDown={handleSplitterPointerDown}
              onDoubleClick={handleSplitterDoubleClick}
              onKeyDown={handleSplitterKeyDown}
            >
              <span className="split-resizer-pill" />
            </div>
          )}

          {selectedScrap && (
            <ScrapDetailPane
              key={selectedScrap.id}
              scrap={selectedScrap}
              onClose={handleCloseDetail}
              onTagClick={handleTagClick}
              isExpanded={effectiveDetailExpanded}
              onToggleExpand={() => setIsDetailExpanded((prev) => !prev)}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={handlePrevScrap}
              onNext={handleNextScrap}
              currentIndex={selectedIndex}
              totalCount={filteredScraps.length}
            />
          )}
        </div>

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
  }

  // Mobile Layout (main 브랜치 스크롤 보정 및 sticky 헤더 유지)
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
        {renderSearchBar()}

        {/* Row 1: 날짜 + 상태 필터 */}
        <div className="flex-between" style={{ gap: "10px" }}>
          {renderDateAndStatusPills()}
        </div>

        {/* Row 2: 클릭형 태그 클라우드 필터 바 */}
        {renderTagFilterBar()}
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
        <div className="scrap-container" style={{ display: "block" }}>
          <div
            className="scrap-left-pane"
            style={{
              flex: "auto",
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
                  isDesktop={false}
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
