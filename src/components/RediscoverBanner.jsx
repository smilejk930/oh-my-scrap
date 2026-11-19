import React, { useMemo, useState } from "react";
import { Sparkles, Shuffle, X } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";

const DISMISS_STORAGE_KEY = "oms_rediscover_dismissed";

const getTodayKey = () => format(new Date(), "yyyy-MM-dd");

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const RediscoverBanner = ({ scraps, onSelectScrap }) => {
  const todayKey = getTodayKey();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === todayKey;
    } catch {
      return false;
    }
  });
  const [offset, setOffset] = useState(0);

  const candidates = useMemo(() => {
    if (!Array.isArray(scraps) || scraps.length < 3) return [];
    const now = new Date();
    const milestones = [];
    const unreadGems = [];

    for (const scrap of scraps) {
      const createdAt = scrap.createdAt?.toDate ? scrap.createdAt.toDate() : null;
      if (!createdAt) continue;
      const diffDays = differenceInCalendarDays(now, createdAt);

      if (diffDays >= 360 && diffDays <= 370) {
        milestones.push({ scrap, badge: "1 Year Ago" });
      } else if (diffDays >= 85 && diffDays <= 95) {
        milestones.push({ scrap, badge: "3 Months Ago" });
      } else if (diffDays >= 28 && diffDays <= 32) {
        milestones.push({ scrap, badge: "1 Month Ago" });
      } else if (diffDays >= 6 && diffDays <= 8) {
        milestones.push({ scrap, badge: "1 Week Ago" });
      } else if (scrap.isRead !== true && diffDays >= 3) {
        unreadGems.push({ scrap, badge: "Unread Gem" });
      }
    }

    if (milestones.length > 0) return milestones;
    if (unreadGems.length > 0) return unreadGems;
    return scraps.map((scrap) => ({ scrap, badge: "Rediscover" }));
  }, [scraps]);

  if (dismissed || candidates.length === 0) return null;

  const baseIdx = hashString(todayKey) % candidates.length;
  const pick = candidates[(baseIdx + offset) % candidates.length];
  const { scrap, badge } = pick;

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, todayKey);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div
      className="rediscover-banner"
      onClick={() => onSelectScrap(scrap)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectScrap(scrap);
        }
      }}
    >
      <img
        src={scrap.thumbnail || "/placeholder.svg"}
        alt=""
        className="rediscover-thumb"
        onError={(e) => {
          e.target.src = "/placeholder.svg";
        }}
      />
      <div className="rediscover-body">
        <div className="rediscover-meta">
          <span className="rediscover-badge">
            <Sparkles size={11} />
            <span>{badge}</span>
          </span>
          {scrap.tags?.[0] && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              #{scrap.tags[0]}
            </span>
          )}
        </div>
        <div className="rediscover-title">
          {scrap.title || "Unanalyzed Scrap"}
        </div>
      </div>
      <div className="rediscover-actions">
        {candidates.length > 1 && (
          <button
            type="button"
            className="rediscover-icon-btn"
            title="Show another pick"
            onClick={(e) => {
              e.stopPropagation();
              setOffset((prev) => prev + 1);
            }}
          >
            <Shuffle size={14} />
          </button>
        )}
        <button
          type="button"
          className="rediscover-icon-btn"
          title="Dismiss for today"
          onClick={handleDismiss}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default RediscoverBanner;
