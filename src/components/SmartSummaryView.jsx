import React, { useMemo } from "react";
import { ChefHat, Code2, PlayCircle, MapPin, ShoppingBag, RotateCcw, Check } from "lucide-react";
import { extractYoutubeVideoId, openSafeUrl } from "../services/scraper";
import { useScraps } from "../context/ScrapContext";

const TYPE_META = {
  recipe: { label: "Recipe", Icon: ChefHat, bg: "rgba(255, 149, 0, 0.12)", color: "#C96A00" },
  tech: { label: "Tech", Icon: Code2, bg: "rgba(88, 86, 214, 0.12)", color: "#4A48B8" },
  video: { label: "Video", Icon: PlayCircle, bg: "rgba(255, 59, 48, 0.12)", color: "#D62828" },
  place: { label: "Place", Icon: MapPin, bg: "rgba(52, 199, 89, 0.14)", color: "#1F8A3D" },
  product: { label: "Product", Icon: ShoppingBag, bg: "rgba(0, 113, 227, 0.12)", color: "#0071E3" },
};

const VALID_TYPES = new Set(["general", "recipe", "tech", "video", "place", "product"]);

const inferContentTypeFromSummary = (summary = "") => {
  if (!summary) return "general";
  if (/\[(?:재료|만드는 법|Ingredients|Instructions)\]/i.test(summary)) return "recipe";
  if (/\[(?:핵심 문제|해결책·아키텍처|Core Problem|Solution & Architecture)\]/i.test(summary)) return "tech";
  if (/\[(?:타임라인 요약|3줄 핵심 요약|Timeline)\]/i.test(summary)) return "video";
  if (/\[(?:위치·특징|추천 메뉴·팁|Location & Highlights)\]/i.test(summary)) return "place";
  if (/\[(?:핵심 스펙·특징|Key Specs & Features|Pros)\]/i.test(summary)) return "product";
  return "general";
};

const parseSummarySections = (summary = "") => {
  const lines = String(summary).split(/\r?\n/);
  const sections = [];
  let current = { header: null, lines: [] };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      if (current.header !== null || current.lines.length > 0) {
        sections.push(current);
      }
      current = { header: headerMatch[1].trim(), lines: [] };
    } else if (trimmed) {
      current.lines.push(trimmed);
    }
  }
  if (current.header !== null || current.lines.length > 0) {
    sections.push(current);
  }
  return sections;
};

const isChecklistSection = (header = "") => {
  const lower = header.toLowerCase();
  return (
    lower.includes("재료") ||
    lower.includes("ingredient") ||
    lower.includes("만드는 법") ||
    lower.includes("instruction")
  );
};

const parseTimestampToSeconds = (ts) => {
  const parts = ts.split(":").map((n) => Number(n));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const renderTextWithTimestamps = (text, youtubeId) => {
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const ts = match[1];
    const seconds = parseTimestampToSeconds(ts);
    if (youtubeId && seconds !== null) {
      parts.push(
        <button
          key={`${match.index}-${ts}`}
          type="button"
          className="timestamp-pill"
          title={`Jump to ${ts}`}
          onClick={(e) => {
            e.stopPropagation();
            openSafeUrl(`https://www.youtube.com/watch?v=${youtubeId}&t=${seconds}s`);
          }}
        >
          {ts}
        </button>
      );
    } else {
      parts.push(
        <span key={`${match.index}-${ts}`} className="timestamp-pill timestamp-pill-static">
          {ts}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const SmartSummaryView = ({ scrap, compact = false }) => {
  const { toggleCheckedItem, resetCheckedItems } = useScraps();
  const fullSummary = scrap?.fullSummary || "";
  const scrapUrl = scrap?.url;
  const rawContentType = scrap?.contentType;
  const rawCheckedItems = scrap?.checkedItems;

  const youtubeId = useMemo(() => extractYoutubeVideoId(scrapUrl), [scrapUrl]);

  const effectiveType = useMemo(() => {
    if (rawContentType && VALID_TYPES.has(rawContentType) && rawContentType !== "general") {
      return rawContentType;
    }
    const inferred = inferContentTypeFromSummary(fullSummary);
    if (inferred !== "general") return inferred;
    return rawContentType || "general";
  }, [rawContentType, fullSummary]);

  const sections = useMemo(() => parseSummarySections(fullSummary), [fullSummary]);
  const hasStructuredHeaders = sections.some((s) => s.header !== null);
  const checkedSet = useMemo(
    () => new Set(Array.isArray(rawCheckedItems) ? rawCheckedItems : []),
    [rawCheckedItems]
  );

  if (!fullSummary) {
    return (
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
        No summary available.
      </p>
    );
  }

  const typeBadge = TYPE_META[effectiveType] || null;
  const TypeIcon = typeBadge?.Icon;

  return (
    <div className={`smart-summary-root ${compact ? "compact" : ""}`}>
      {typeBadge && (
        <div className="smart-summary-top-row">
          <span
            className="content-type-badge"
            style={{ background: typeBadge.bg, color: typeBadge.color }}
          >
            <TypeIcon size={12} />
            <span>{typeBadge.label}</span>
          </span>
          {effectiveType === "recipe" && checkedSet.size > 0 && (
            <button
              type="button"
              className="recipe-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetCheckedItems(scrap.id);
              }}
              title="Reset checklist"
            >
              <RotateCcw size={12} />
              <span>Reset ({checkedSet.size})</span>
            </button>
          )}
        </div>
      )}

      {!hasStructuredHeaders ? (
        <p className="smart-summary-prose">
          {renderTextWithTimestamps(fullSummary, youtubeId)}
        </p>
      ) : (
        <div className="smart-summary-sections">
          {sections.map((section, sIdx) => {
            const checklistMode = effectiveType === "recipe" && isChecklistSection(section.header || "");
            return (
              <div key={`${section.header || "intro"}-${sIdx}`} className="smart-summary-section">
                {section.header && (
                  <div className="smart-summary-section-header">{section.header}</div>
                )}
                <div className="smart-summary-section-body">
                  {section.lines.map((line, lIdx) => {
                    const isBullet = /^[-•*]\s+/.test(line);
                    const cleanLine = line.replace(/^[-•*]\s+/, "");

                    if (checklistMode) {
                      const itemKey = `${sIdx}:${lIdx}:${cleanLine.slice(0, 24)}`;
                      const isChecked = checkedSet.has(itemKey);
                      return (
                        <button
                          key={itemKey}
                          type="button"
                          className={`recipe-check-row ${isChecked ? "checked" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCheckedItem(scrap, itemKey);
                          }}
                        >
                          <span className={`recipe-checkbox ${isChecked ? "checked" : ""}`}>
                            {isChecked && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className="recipe-check-text">
                            {renderTextWithTimestamps(cleanLine, youtubeId)}
                          </span>
                        </button>
                      );
                    }

                    if (isBullet) {
                      return (
                        <div key={`${sIdx}-${lIdx}`} className="smart-summary-bullet">
                          <span className="smart-summary-bullet-dot">•</span>
                          <span>{renderTextWithTimestamps(cleanLine, youtubeId)}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={`${sIdx}-${lIdx}`} className="smart-summary-line">
                        {renderTextWithTimestamps(line, youtubeId)}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmartSummaryView;
